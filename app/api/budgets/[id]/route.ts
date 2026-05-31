import { auth } from "@/lib/auth";
import {
  BudgetCategoryError,
  BudgetDateOverlapError,
  BudgetDateRangeError,
  BudgetNotFoundError,
  deleteBudget,
  getBudget,
  updateBudget,
} from "@/lib/services/budget.service";
import { budgetUpdateSchema } from "@/lib/validations/budget.schema";

type BudgetRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function budgetErrorResponse(error: unknown) {
  if (error instanceof BudgetNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof BudgetCategoryError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof BudgetDateOverlapError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof BudgetDateRangeError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  throw error;
}

export async function GET(_request: Request, context: BudgetRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    const budget = await getBudget(id, userId);

    return Response.json({ data: budget });
  } catch (error) {
    return budgetErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: BudgetRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsedBody = budgetUpdateSchema.safeParse(body);

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
    const budget = await updateBudget(id, userId, parsedBody.data);

    return Response.json({ data: budget });
  } catch (error) {
    return budgetErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: BudgetRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    await deleteBudget(id, userId);

    return Response.json({ data: { id } });
  } catch (error) {
    return budgetErrorResponse(error);
  }
}
