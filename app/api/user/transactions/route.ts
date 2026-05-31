import { auth } from "@/lib/auth";
import { deleteUserTransactions } from "@/lib/services/user.service";
import { deleteUserTransactionsSchema } from "@/lib/validations/user.schema";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsedBody = deleteUserTransactionsSchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json(
      {
        error: "Validation failed",
        fields: parsedBody.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await deleteUserTransactions(userId);

  return Response.json({ data: result });
}
