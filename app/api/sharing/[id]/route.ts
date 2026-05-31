import { auth } from "@/lib/auth";
import {
  SharingConnectionNotFoundError,
  acceptSharingInvitation,
  deleteSharingConnection,
  rejectSharingInvitation,
} from "@/lib/services/sharing.service";
import { sharingActionSchema } from "@/lib/validations/sharing.schema";

type SharingRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function sharingErrorResponse(error: unknown) {
  if (error instanceof SharingConnectionNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  throw error;
}

export async function PATCH(request: Request, context: SharingRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsedBody = sharingActionSchema.safeParse(body);

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
    const connection =
      parsedBody.data.action === "accept"
        ? await acceptSharingInvitation(id, userId)
        : await rejectSharingInvitation(id, userId);

    return Response.json({ data: connection });
  } catch (error) {
    return sharingErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: SharingRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    const connection = await deleteSharingConnection(id, userId);

    return Response.json({ data: connection });
  } catch (error) {
    return sharingErrorResponse(error);
  }
}
