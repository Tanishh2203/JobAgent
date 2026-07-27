// Fires an on-demand scrape for one user, right after they save Settings,
// instead of making them wait for the next scheduled all-users run.
//
// Mechanism: AWS SSM RunCommand tells the EC2 box running scraper.py to
// execute `scraper.py --user-id <id>` immediately. Fire-and-forget — this
// only confirms the command was *accepted* by SSM, not that the scrape
// finished (a real scrape takes 1-2+ minutes; the caller shouldn't block on it).
import { SSMClient, SendCommandCommand } from "@aws-sdk/client-ssm";

export interface TriggerResult {
  triggered: boolean;
  reason?: string;
  commandId?: string;
}

let client: SSMClient | null = null;
function getClient(): SSMClient | null {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) return null;
  if (!client) {
    client = new SSMClient({ region, credentials: { accessKeyId, secretAccessKey } });
  }
  return client;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function triggerScrapeForUser(userId: string): Promise<TriggerResult> {
  // userId is interpolated into a shell command below (via SSM RunShellScript),
  // so it must be validated as a UUID first — defense in depth even though
  // callers only ever pass Supabase's own auth.uid().
  if (!UUID_RE.test(userId)) return { triggered: false, reason: "invalid userId" };

  const instanceId = process.env.SCRAPER_EC2_INSTANCE_ID;
  if (!instanceId) return { triggered: false, reason: "SCRAPER_EC2_INSTANCE_ID not configured" };

  const ssm = getClient();
  if (!ssm) return { triggered: false, reason: "AWS credentials not configured" };

  try {
    const out = await ssm.send(new SendCommandCommand({
      InstanceIds: [instanceId],
      DocumentName: "AWS-RunShellScript",
      Parameters: {
        commands: [
          "cd /home/ubuntu/job-agent/scraper",
          `.venv/bin/python scraper.py --user-id ${userId}`,
        ],
      },
      TimeoutSeconds: 600,
    }));
    return { triggered: true, commandId: out.Command?.CommandId };
  } catch (err) {
    return { triggered: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
