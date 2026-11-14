"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/Controls";
import { accountsCopy } from "./copy";

/** The login form's "Keep me signed in" box, unticked to start. */
export default function KeepSignedIn() {
  const [keep, setKeep] = useState(false);
  return (
    <Checkbox name="remember" checked={keep} onChange={setKeep}>
      {accountsCopy.login.keep}
    </Checkbox>
  );
}
