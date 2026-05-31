import {
  CategoryInUseError,
  CategoryNotFoundError,
  DefaultCategoryMutationError,
  deleteCategory,
  updateCategory,
} from "@/lib/services/category.service";
import { auth } from "@/lib/auth";
import { categoryUpdateSchema } from "@/lib/validations/category.schema";

type CategoryRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function errorResponse(error: unknown) {
  if (error instanceof CategoryNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof DefaultCategoryMutationError) {
    return Response.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof CategoryInUseError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  throw error;
}

export async function PATCH(request: Request, context: CategoryRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsedBody = categoryUpdateSchema.safeParse(body);

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
    const category = await updateCategory(id, userId, parsedBody.data);

    return Response.json({ data: category });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: CategoryRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    await deleteCategory(id, userId);

    return Response.json({ data: { id } });
  } catch (error) {
    return errorResponse(error);
  }
}
