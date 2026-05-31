import { auth } from "@/lib/auth";
import {
  TransactionCategoryError,
  createTransaction,
  getTransactions,
} from "@/lib/services/transaction.service";
import {
  transactionFiltersSchema,
  transactionSchema,
} from "@/lib/validations/transaction.schema";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function transactionErrorResponse(error: unknown) {
  if (error instanceof TransactionCategoryError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  throw error;
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedFilters = transactionFiltersSchema.safeParse(Object.fromEntries(searchParams));

  if (!parsedFilters.success) {
    return Response.json(
      {
        error: "Validation failed",
        fields: parsedFilters.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const transactions = await getTransactions(userId, parsedFilters.data);

  return Response.json(transactions);
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsedBody = transactionSchema.safeParse(body);

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
    const transaction = await createTransaction(userId, parsedBody.data);

    return Response.json({ data: transaction }, { status: 201 });
  } catch (error) {
    return transactionErrorResponse(error);
  }
}
