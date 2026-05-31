import { auth } from "@/lib/auth";
import {
  DuplicatePocketNameError,
  createPocket,
  getPockets,
} from "@/lib/services/pocket.service";
import { pocketSchema } from "@/lib/validations/pocket.schema";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function pocketErrorResponse(error: unknown) {
  if (error instanceof DuplicatePocketNameError) {
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

  const pockets = await getPockets(userId);

  return Response.json({ data: pockets });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsedBody = pocketSchema.safeParse(body);

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
    const pocket = await createPocket(userId, parsedBody.data);

    return Response.json({ data: pocket }, { status: 201 });
  } catch (error) {
    return pocketErrorResponse(error);
  }
}
