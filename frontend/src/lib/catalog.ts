/** Every incident on both deployments, grouped for pickers and the All incidents page. */
import { getConfig, getIncident } from "./reads";
import { groupOf, plainName, type Deployment, type IncidentGroup } from "./config";
import type { Incident } from "./types";

export type Entry = { ref: string; dep: Deployment; id: number; name: string; group: IncidentGroup; inc: Incident };

export async function catalog(): Promise<{ entries: Entry[]; failed: Deployment[] }> {
  const entries: Entry[] = [];
  const failed: Deployment[] = [];
  for (const dep of ["c", "d"] as Deployment[]) {
    try {
      const n = (await getConfig(dep)).incidents;
      const incs = await Promise.all(Array.from({ length: n }, (_, i) => getIncident(dep, i + 1)));
      for (const inc of incs) {
        const ref = { dep, id: inc.incident_id, title: inc.title };
        entries.push({ ref: `${dep}-${inc.incident_id}`, dep, id: inc.incident_id, name: plainName(ref), group: groupOf(ref), inc });
      }
    } catch { failed.push(dep); }
  }
  const order: IncidentGroup[] = ["canonical", "scenario", "copy", "test"];
  entries.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || (a.group === "copy" ? b.id - a.id : a.id - b.id));
  return { entries, failed };
}
