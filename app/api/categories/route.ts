import { auth } from "@/lib/auth";
import { createCategory, getCategories } from "@/lib/services/category.service";
import { categorySchema } from "@/lib/validations/category.schema";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const categories = await getCategories(userId);

  return Response.json({ data: categories });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsedBody = categorySchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json(
      {
        error: "Validation failed",
        fields: parsedBody.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const category = await createCategory(userId, parsedBody.data);

  return Response.json({ data: category }, { status: 201 });
}
