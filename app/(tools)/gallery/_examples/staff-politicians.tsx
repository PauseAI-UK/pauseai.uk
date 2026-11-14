// The staff interface's politicians and asks: the list, its filters and
// icons, a politician's page, and the asks, on fake politicians.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import { answerWordGallery } from "@/app/(staff)/staff/_components/campaigns/AnswerWord.gallery";
import { askFormGallery } from "@/app/(staff)/staff/_components/campaigns/AskForm.gallery";
import { askKindIconGallery } from "@/app/(staff)/staff/_components/campaigns/AskKindIcon.gallery";
import { askLineGallery } from "@/app/(staff)/staff/_components/campaigns/AskLine.gallery";
import { asksListGallery } from "@/app/(staff)/staff/_components/campaigns/AsksList.gallery";
import { askViewGallery } from "@/app/(staff)/staff/_components/campaigns/AskView.gallery";
import { askWaysGallery } from "@/app/(staff)/staff/_components/campaigns/AskWays.gallery";
import { addAliasFormGallery } from "@/app/(staff)/staff/_components/politicians/AddAliasForm.gallery";
import { askRowGallery } from "@/app/(staff)/staff/_components/politicians/AskRow.gallery";
import { pasteFormGallery } from "@/app/(staff)/staff/_components/politicians/PasteForm.gallery";
import { pickBoxGallery } from "@/app/(staff)/staff/_components/politicians/PickBox.gallery";
import { politicianCorrespondenceGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianCorrespondence.gallery";
import { politicianDetailsGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianDetails.gallery";
import { politicianFiltersGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianFilters.gallery";
import { politicianIconsGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianIcons.gallery";
import { politicianMarksGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianMarks.gallery";
import { politicianTableGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianTable.gallery";
import { politicianWritingGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianWriting.gallery";
import { politiciansListGallery } from "@/app/(staff)/staff/_components/politicians/PoliticiansList.gallery";
import type { Group } from "../_components/types";

const [houseTabs, choosingHead, politiciansList] = politiciansListGallery;

export const staffPoliticians: Group = {
  id: "staff-politicians",
  title: "The staff interface: politicians and asks",
  examples: [
    houseTabs,
    choosingHead,
    ...pasteFormGallery,
    ...pickBoxGallery,
    politiciansList,
    ...askRowGallery,
    ...politicianCorrespondenceGallery,
    ...politicianDetailsGallery,
    ...politicianMarksGallery,
    ...politicianWritingGallery,
    ...addAliasFormGallery,
    ...politicianFiltersGallery,
    ...askLineGallery,
    ...askFormGallery,
    ...askViewGallery,
    ...answerWordGallery,
    ...askWaysGallery,
    ...askKindIconGallery,
    ...asksListGallery,
    ...politicianTableGallery,
    ...politicianIconsGallery,
  ],
};
