import { auth } from "@/lib/auth";
import {
  BudgetCategoryError,
  BudgetDateOverlapError,
  BudgetDateRangeError,
  createBudget,
  getBudgets,
} from "@/lib/services/budget.service";
import { budgetSchema } from "@/lib/validations/budget.schema";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function budgetErrorResponse(error: unknown) {
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

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const budgets = await getBudgets(userId);

  return Response.json({ data: budgets });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsedBody = budgetSchema.safeParse(body);

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
    const budget = await createBudget(userId, parsedBody.data);

    return Response.json({ data: budget }, { status: 201 });
  } catch (error) {
    return budgetErrorResponse(error);
  }
}
