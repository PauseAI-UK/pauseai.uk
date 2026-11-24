"use client";

// MenuSubmit's examples that keep state or log what's pressed (MenuSubmit.gallery.tsx).
import { Logged, loggedDone } from "@/app/(tools)/gallery/_components/wiring";
import Menu, { menuItemsClass } from "./Menu";
import MenuSubmit from "./MenuSubmit";
import { Refusal, ResultForm } from "./ResultForm";

/** A menu holding an item that sends a form, logged. */
export function MenuSubmitExample() {
  return (
    <Logged>
      {(log) => (
        <Menu id="example-menu-submit" label="Choose">
          <ResultForm action={loggedDone(log, "update")} says={{}} className={menuItemsClass}>
            <MenuSubmit>Update for everyone</MenuSubmit>
            <Refusal />
          </ResultForm>
        </Menu>
      )}
    </Logged>
  );
}
