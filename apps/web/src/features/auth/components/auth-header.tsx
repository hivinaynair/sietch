"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import styles from "./auth-header.module.css";

export function AuthHeader() {
  return (
    <header className={styles.header}>
      <Show when="signed-out">
        <SignInButton />
        <SignUpButton />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </header>
  );
}
