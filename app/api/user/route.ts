import { auth } from "@/lib/auth";
import {
  InvalidPasswordError,
  UserNotFoundError,
  deleteUserAccount,
} from "@/lib/services/user.service";
import { deleteUserAccountSchema } from "@/lib/validations/user.schema";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function userErrorResponse(error: unknown) {
  if (error instanceof InvalidPasswordError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof UserNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  throw error;
}

export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsedBody = deleteUserAccountSchema.safeParse(body);

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
    const result = await deleteUserAccount(userId, parsedBody.data);

    return Response.json({ data: result });
  } catch (error) {
    return userErrorResponse(error);
  }
}
