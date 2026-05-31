import { auth } from "@/lib/auth";
import {
  SharingAlreadyConnectedError,
  SharingPendingInvitationError,
  SharingSelfInviteError,
  SharingUserNotFoundError,
  createSharingInvitation,
  getSharingOverview,
} from "@/lib/services/sharing.service";
import { sharingInviteSchema } from "@/lib/validations/sharing.schema";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function sharingErrorResponse(error: unknown) {
  if (error instanceof SharingUserNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof SharingSelfInviteError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof SharingAlreadyConnectedError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof SharingPendingInvitationError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  throw error;
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const overview = await getSharingOverview(userId);

  return Response.json({ data: overview });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsedBody = sharingInviteSchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json(
      {
        error: "Validation failed",
        fields: parsedBody.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const connection = await createSharingInvitation(userId, parsedBody.data);

    return Response.json({ data: connection }, { status: 201 });
  } catch (error) {
    return sharingErrorResponse(error);
  }
}
