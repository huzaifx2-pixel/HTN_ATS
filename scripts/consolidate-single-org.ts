import { consolidateAllUsersToCanonicalOrg } from "@/lib/org/ensure-canonical-org";

consolidateAllUsersToCanonicalOrg()
  .then((result) => {
    console.log("Consolidated users to single org:", result);
  })
  .catch(console.error);
