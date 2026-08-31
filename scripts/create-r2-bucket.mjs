const accountId = "df161f6a44f7a66be880ee139e6e418c";
const token = process.env.CLOUDFLARE_API_TOKEN;
const bucket = process.env.R2_BUCKET_NAME ?? "headsbase-ats";

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: bucket }),
  }
);

const body = await response.json();
console.log(JSON.stringify(body, null, 2));
process.exit(body.success ? 0 : 1);
