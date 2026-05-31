import { auth } from "@/lib/auth";
import { getMonthlyReport } from "@/lib/services/report.service";
import { reportMonthlyQuerySchema } from "@/lib/validations/report.schema";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return unauthorized();
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedQuery = reportMonthlyQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsedQuery.success) {
    return Response.json(
      {
        error: "Validation failed",
        fields: parsedQuery.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const monthlyChart = await getMonthlyReport(userId, parsedQuery.data);

  return Response.json({ data: monthlyChart });
}
