import { auth } from "@/lib/auth";
import {
  TransactionCategoryError,
  TransactionNotFoundError,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/lib/services/transaction.service";
import { transactionUpdateSchema } from "@/lib/validations/transaction.schema";

type TransactionRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function transactionErrorResponse(error: unknown) {
  if (error instanceof TransactionNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof TransactionCategoryError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  throw error;
}

export async function GET(_request: Request, context: TransactionRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    const transaction = await getTransaction(id, userId);

    return Response.json({ data: transaction });
  } catch (error) {
    return transactionErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: TransactionRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsedBody = transactionUpdateSchema.safeParse(body);

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
    const transaction = await updateTransaction(id, userId, parsedBody.data);

    return Response.json({ data: transaction });
  } catch (error) {
    return transactionErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: TransactionRouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    await deleteTransaction(id, userId);

    return Response.json({ data: { id } });
  } catch (error) {
    return transactionErrorResponse(error);
  }
}
