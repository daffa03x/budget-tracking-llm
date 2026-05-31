import { hash, compare } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import type { LoginInput, RegisterInput } from "@/lib/validations/auth.schema";
import type {
  DeleteUserAccountInput,
  UserPasswordUpdateInput,
  UserProfileUpdateInput,
} from "@/lib/validations/user.schema";

export class DuplicateEmailError extends Error {
  constructor() {
    super("Email sudah terdaftar.");
    this.name = "DuplicateEmailError";
  }
}

export class InvalidPasswordError extends Error {
  constructor(message = "Password tidak valid.") {
    super(message);
    this.name = "InvalidPasswordError";
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("User tidak ditemukan.");
    this.name = "UserNotFoundError";
  }
}

type UserProfileRecord = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

function serializeUserProfile(user: UserProfileRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    currency: user.currency,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function getUserPassword(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
    },
  });

  if (!user) {
    throw new UserNotFoundError();
  }

  if (!user.password) {
    throw new InvalidPasswordError("Akun ini belum memiliki password lokal.");
  }

  return user.password;
}

async function assertCurrentPassword(userId: string, password: string) {
  const hashedPassword = await getUserPassword(userId);
  const isValidPassword = await compare(password, hashedPassword);

  if (!isValidPassword) {
    throw new InvalidPasswordError("Password saat ini salah.");
  }
}

export async function registerUser(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new DuplicateEmailError();
  }

  const password = await hash(input.password, 12);

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password,
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      currency: true,
    },
  });
}

export async function validateUserCredentials(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      password: true,
      currency: true,
    },
  });

  if (!user?.password) {
    return null;
  }

  const isValidPassword = await compare(input.password, user.password);

  if (!isValidPassword) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    currency: user.currency,
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user ? serializeUserProfile(user) : null;
}

export async function updateUserProfile(userId: string, input: UserProfileUpdateInput) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
    },
  });

  if (!currentUser) {
    throw new UserNotFoundError();
  }

  if (input.email && input.email !== currentUser.email) {
    if (!input.currentPassword) {
      throw new InvalidPasswordError("Password saat ini wajib diisi untuk mengganti email.");
    }

    await assertCurrentPassword(userId, input.currentPassword);

    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new DuplicateEmailError();
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return serializeUserProfile(user);
}

export async function updateUserPassword(userId: string, input: UserPasswordUpdateInput) {
  await assertCurrentPassword(userId, input.currentPassword);

  const password = await hash(input.newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { password },
    select: { id: true },
  });

  return { id: userId };
}

export async function deleteUserTransactions(userId: string) {
  const [transactions, budgets] = await prisma.$transaction([
    prisma.transaction.deleteMany({
      where: { userId },
    }),
    prisma.budget.updateMany({
      where: { userId },
      data: {
        spent: "0.00",
      },
    }),
  ]);

  return {
    transactionCount: transactions.count,
    budgetCount: budgets.count,
  };
}

export async function deleteUserAccount(userId: string, input: DeleteUserAccountInput) {
  await assertCurrentPassword(userId, input.password);

  await prisma.user.delete({
    where: { id: userId },
    select: { id: true },
  });

  return { id: userId };
}
