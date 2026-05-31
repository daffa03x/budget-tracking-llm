import { auth } from "@/lib/auth";
import {
  buildReportExportFilename,
  buildTransactionsCsv,
  getReportExportRows,
} from "@/lib/services/report.service";
import { reportExportQuerySchema } from "@/lib/validations/report.schema";

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
  const parsedQuery = reportExportQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsedQuery.success) {
    return Response.json(
      {
        error: "Validation failed",
        fields: parsedQuery.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const rows = await getReportExportRows(userId, parsedQuery.data);
  const csv = buildTransactionsCsv(rows);
  const filename = buildReportExportFilename(parsedQuery.data);

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
