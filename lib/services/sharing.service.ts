import { prisma } from "@/lib/prisma";
import type { SharingInviteInput } from "@/lib/validations/sharing.schema";

const sharingUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

const sharingConnectionInclude = {
  requester: {
    select: sharingUserSelect,
  },
  recipient: {
    select: sharingUserSelect,
  },
} as const;

type SharingUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

type SharingConnectionRecord = {
  id: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  requesterId: string;
  recipientId: string;
  requester: SharingUser;
  recipient: SharingUser;
};

export class SharingUserNotFoundError extends Error {
  constructor() {
    super("Akun dengan email tersebut tidak ditemukan.");
    this.name = "SharingUserNotFoundError";
  }
}

export class SharingSelfInviteError extends Error {
  constructor() {
    super("Anda tidak bisa menghubungkan akun sendiri.");
    this.name = "SharingSelfInviteError";
  }
}

export class SharingAlreadyConnectedError extends Error {
  constructor() {
    super("Akun ini sudah terhubung.");
    this.name = "SharingAlreadyConnectedError";
  }
}

export class SharingPendingInvitationError extends Error {
  constructor() {
    super("Undangan koneksi dengan akun ini masih menunggu konfirmasi.");
    this.name = "SharingPendingInvitationError";
  }
}

export class SharingConnectionNotFoundError extends Error {
  constructor() {
    super("Koneksi sharing tidak ditemukan.");
    this.name = "SharingConnectionNotFoundError";
  }
}

function serializeUser(user: SharingUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  };
}

function serializeConnection(connection: SharingConnectionRecord, currentUserId: string) {
  const direction: "outgoing" | "incoming" =
    connection.requesterId === currentUserId ? "outgoing" : "incoming";
  const partner =
    connection.requesterId === currentUserId ? connection.recipient : connection.requester;

  return {
    id: connection.id,
    status: connection.status,
    direction,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
    acceptedAt: connection.acceptedAt?.toISOString() ?? null,
    requester: serializeUser(connection.requester),
    recipient: serializeUser(connection.recipient),
    partner: serializeUser(partner),
  };
}

export async function getFinancialScopeUserIds(userId: string) {
  const connections = await prisma.accountConnection.findMany({
    where: {
      status: "accepted",
      OR: [
        {
          requesterId: userId,
        },
        {
          recipientId: userId,
        },
      ],
    },
    select: {
      requesterId: true,
      recipientId: true,
    },
  });
  const scope = new Set<string>([userId]);

  connections.forEach((connection) => {
    scope.add(connection.requesterId === userId ? connection.recipientId : connection.requesterId);
  });

  return Array.from(scope);
}

export async function getSharingOverview(userId: string) {
  const [connections, scopeUserIds] = await Promise.all([
    prisma.accountConnection.findMany({
      where: {
        OR: [
          {
            requesterId: userId,
          },
          {
            recipientId: userId,
          },
        ],
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: sharingConnectionInclude,
    }),
    getFinancialScopeUserIds(userId),
  ]);
  const serializedConnections = connections.map((connection) =>
    serializeConnection(connection, userId),
  );

  return {
    scopeUserIds,
    connections: serializedConnections.filter((connection) => connection.status === "accepted"),
    incomingInvitations: serializedConnections.filter(
      (connection) => connection.status === "pending" && connection.direction === "incoming",
    ),
    outgoingInvitations: serializedConnections.filter(
      (connection) => connection.status === "pending" && connection.direction === "outgoing",
    ),
  };
}

export async function createSharingInvitation(userId: string, input: SharingInviteInput) {
  const recipient = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
    select: sharingUserSelect,
  });

  if (!recipient) {
    throw new SharingUserNotFoundError();
  }

  if (recipient.id === userId) {
    throw new SharingSelfInviteError();
  }

  const existingConnection = await prisma.accountConnection.findFirst({
    where: {
      OR: [
        {
          requesterId: userId,
          recipientId: recipient.id,
        },
        {
          requesterId: recipient.id,
          recipientId: userId,
        },
      ],
    },
    include: sharingConnectionInclude,
  });

  if (existingConnection?.status === "accepted") {
    throw new SharingAlreadyConnectedError();
  }

  if (existingConnection?.status === "pending") {
    throw new SharingPendingInvitationError();
  }

  if (existingConnection) {
    const connection = await prisma.accountConnection.update({
      where: {
        id: existingConnection.id,
      },
      data: {
        requesterId: userId,
        recipientId: recipient.id,
        status: "pending",
        acceptedAt: null,
      },
      include: sharingConnectionInclude,
    });

    return serializeConnection(connection, userId);
  }

  const connection = await prisma.accountConnection.create({
    data: {
      requesterId: userId,
      recipientId: recipient.id,
      status: "pending",
    },
    include: sharingConnectionInclude,
  });

  return serializeConnection(connection, userId);
}

export async function acceptSharingInvitation(id: string, userId: string) {
  const connection = await prisma.accountConnection.findFirst({
    where: {
      id,
      recipientId: userId,
      status: "pending",
    },
    select: {
      id: true,
    },
  });

  if (!connection) {
    throw new SharingConnectionNotFoundError();
  }

  const acceptedConnection = await prisma.accountConnection.update({
    where: {
      id,
    },
    data: {
      status: "accepted",
      acceptedAt: new Date(),
    },
    include: sharingConnectionInclude,
  });

  return serializeConnection(acceptedConnection, userId);
}

export async function rejectSharingInvitation(id: string, userId: string) {
  const connection = await prisma.accountConnection.findFirst({
    where: {
      id,
      recipientId: userId,
      status: "pending",
    },
    select: {
      id: true,
    },
  });

  if (!connection) {
    throw new SharingConnectionNotFoundError();
  }

  const rejectedConnection = await prisma.accountConnection.update({
    where: {
      id,
    },
    data: {
      status: "rejected",
      acceptedAt: null,
    },
    include: sharingConnectionInclude,
  });

  return serializeConnection(rejectedConnection, userId);
}

export async function deleteSharingConnection(id: string, userId: string) {
  const connection = await prisma.accountConnection.findFirst({
    where: {
      id,
      OR: [
        {
          requesterId: userId,
        },
        {
          recipientId: userId,
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (!connection) {
    throw new SharingConnectionNotFoundError();
  }

  await prisma.accountConnection.delete({
    where: {
      id,
    },
  });

  return { id };
}
