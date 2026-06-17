import { Badge } from "@/components/ui/Badge";
import { CONDITION_VISUALS } from "@/lib/conditionVisuals";
import type { ConditionFlag } from "@/lib/types";

export function ConditionBadges({ flags }: { flags: ConditionFlag[] }) {
  if (!flags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((f, i) => {
        const v = CONDITION_VISUALS[f.condition];
        return (
          <Badge key={`${f.condition}-${i}`} className={v.badgeClass}>
            {v.label}
            {f.condition !== "healthy" && f.condition !== "dead" && (
              <span className="ml-1 opacity-70">· {f.severity}</span>
            )}
          </Badge>
        );
      })}
    </div>
  );
}
