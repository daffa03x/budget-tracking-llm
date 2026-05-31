import { auth } from "@/lib/auth";
import {
  DuplicateEmailError,
  InvalidPasswordError,
  UserNotFoundError,
  getUserProfile,
  updateUserProfile,
} from "@/lib/services/user.service";
import { userProfileUpdateSchema } from "@/lib/validations/user.schema";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function userErrorResponse(error: unknown) {
  if (error instanceof DuplicateEmailError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof InvalidPasswordError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof UserNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  throw error;
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const profile = await getUserProfile(userId);

  if (!profile) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ data: profile });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsedBody = userProfileUpdateSchema.safeParse(body);

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
    const profile = await updateUserProfile(userId, parsedBody.data);

    return Response.json({ data: profile });
  } catch (error) {
    return userErrorResponse(error);
  }
}
