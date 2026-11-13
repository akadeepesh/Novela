import type { PrintSettings } from "@/lib/store/db"
import { DEFAULT_TEMPLATE_ID } from "./builtin-templates"

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  templateId: DEFAULT_TEMPLATE_ID,
  printer: "kdp",
  paper: "cream",
  bleed: false,
  copyrightText: "",
}

/** A sensible copyright page for a novel, used until the writer edits it. */
export function defaultCopyrightText(author: string | undefined, year = new Date().getFullYear()): string {
  const holder = author?.trim() || "the author"
  return [
    `Copyright © ${year} ${holder}`,
    "All rights reserved. No part of this book may be reproduced in any form or by any electronic or mechanical means without written permission from the author, except for brief quotations in a review.",
    "This is a work of fiction. Names, characters, places and incidents are the product of the author's imagination or are used fictitiously.",
    `First edition ${year}`,
  ].join("\n\n")
}
