
export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).all();

    return Response.json({
      success: true,
      message: "D1 database connection successful.",
      tables: result.results.map((table) => table.name)
    });
  } catch (error) {
    console.error("D1 connection test failed:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to query the D1 database."
      },
      { status: 500 }
    );
  }
}
