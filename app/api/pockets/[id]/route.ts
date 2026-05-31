import { auth } from "@/lib/auth";
import {
  DuplicatePocketNameError,
  PocketInUseError,
  PocketNotFoundError,
  deletePocket,
  updatePocket,
} from "@/lib/services/pocket.service";
import { pocketUpdateSchema } from "@/lib/validations/pocket.schema";

type PocketRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function pocketErrorResponse(error: unknown) {
  if (error instanceof PocketNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof DuplicatePocketNameError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof PocketInUseError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  throw error;
}

export async function PATCH(request: Request, context: PocketRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsedBody = pocketUpdateSchema.safeParse(body);

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
    const pocket = await updatePocket(id, userId, parsedBody.data);

    return Response.json({ data: pocket });
  } catch (error) {
    return pocketErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: PocketRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    await deletePocket(id, userId);

    return Response.json({ data: { id } });
  } catch (error) {
    return pocketErrorResponse(error);
  }
}
