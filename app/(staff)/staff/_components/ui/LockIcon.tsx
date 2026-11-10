import styles from "./NotIcon.module.css";

/** The mark of what can't be changed here, after its words, as a chip's arrow would be: a padlock. */
export default function LockIcon() {
  return (
    <svg className={styles.lockIcon} width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
