import { Muted } from "@/components/ui/Text";
import type { AskWay } from "@/lib/asks/records";
import StaffLink from "../ui/StaffLink";
import styles from "./AskWays.module.css";
import { asksCopy } from "@/lib/asks/copy";

/**
 * The campaigns and mailings that put an ask, each kind under its own heading,
 * and in a tight column of its own, so they line up from one ask to the next. `wide`, for the whole of a page: the kinds side by
 * side, with how many letters each sent at the end of its line.
 */
export default function AskWays({ ways, wide = false }: { ways: AskWay[]; wide?: boolean }) {
  return (
    <div className={wide ? `${styles.ways} ${styles.wide}` : styles.ways}>
      {(["campaign", "mailing"] as const).map((kind) => {
        const theirs = ways.filter((way) => way.kind === kind);
        return (
          theirs.length > 0 && (
            <div key={kind} className={styles[kind]}>
              <p className={styles.heading}>{asksCopy.asks.waysOf[kind]}</p>
              <ul>
                {theirs.map((way) => (
                  <li key={way.href}>
                    <StaffLink href={way.href}>{way.title}</StaffLink>
                    {wide && <Muted>{asksCopy.asks.page.letters(way.letters)}</Muted>}
                  </li>
                ))}
              </ul>
            </div>
          )
        );
      })}
    </div>
  );
}
