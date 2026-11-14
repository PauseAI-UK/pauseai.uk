import { eraseLeftovers } from "@/lib/staff-search";
import Strip from "../ui/Strip";
import { erasureCopy } from "@/lib/erasure/copy";

/**
 * After an erasure, at the top of the list, read out: done, in green; or
 * done but something couldn't be cleared afterwards, in amber, with what
 * (`why`, as codes, a line each). Nothing otherwise.
 */
export default function ErasedNotice({ erased, why = "" }: { erased: string; why?: string }) {
  if (erased === "1")
    return (
      <Strip tone="green" announce>
        {erasureCopy.erase.done}
      </Strip>
    );
  if (erased === "partly")
    return (
      <Strip tone="amber" announce>
        {erasureCopy.erase.partly}
        <ul>
          {eraseLeftovers(why).map((leftover) => (
            <li key={leftover}>{erasureCopy.erase.notCleared[leftover]}</li>
          ))}
        </ul>
      </Strip>
    );
  return null;
}
