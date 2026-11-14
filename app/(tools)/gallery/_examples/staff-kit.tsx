// The staff interface's own kit (app/(staff)/staff/_components/ui and the
// pieces every staff page shares): the page frame, which sets the compact
// density, the navigation, lists, tabs, bands, filters, menus and bubbles.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import { staffNavGallery } from "@/app/(staff)/staff/_components/shell/StaffNav.gallery";
import { navIconGallery } from "@/app/(staff)/staff/_components/shell/NavIcon.gallery";
import type { Group } from "../_components/types";
import { staffPageGallery } from "@/app/(staff)/staff/_components/ui/StaffPage.gallery";
import { gridGallery } from "@/app/(staff)/staff/_components/ui/Grid.gallery";
import { numberedGallery } from "@/app/(staff)/staff/_components/ui/Numbered.gallery";
import { staffLinkGallery } from "@/app/(staff)/staff/_components/ui/StaffLink.gallery";
import { externalLinkGallery } from "@/app/(staff)/staff/_components/ui/ExternalLink.gallery";
import { testTagGallery } from "@/app/(staff)/staff/_components/ui/TestTag.gallery";
import { formPendingGallery } from "@/app/(staff)/staff/_components/ui/FormPending.gallery";
import { navFoldGallery } from "@/app/(staff)/staff/_components/ui/NavFold.gallery";
import { withheldGallery } from "@/app/(staff)/staff/_components/ui/Withheld.gallery";
import { choiceSearchGallery } from "@/app/(staff)/staff/_components/ui/ChoiceSearch.gallery";
import { listFrameGallery } from "@/app/(staff)/staff/_components/ui/ListFrame.gallery";
import { shortenedGallery } from "@/app/(staff)/staff/_components/ui/Shortened.gallery";
import { whenGallery } from "@/app/(staff)/staff/_components/ui/When.gallery";
import { tabsGallery } from "@/app/(staff)/staff/_components/ui/Tabs.gallery";
import { pageHeadGallery } from "@/app/(staff)/staff/_components/ui/PageHead.gallery";
import { pageGallery } from "@/app/(staff)/staff/_components/ui/Page.gallery";
import { downloadMenuGallery } from "@/app/(staff)/staff/_components/ui/DownloadMenu.gallery";
import { bandGallery } from "@/app/(staff)/staff/_components/ui/Band.gallery";
import { countsGallery } from "@/app/(staff)/staff/_components/ui/Counts.gallery";
import { progressGallery } from "@/app/(staff)/staff/_components/ui/Progress.gallery";
import { stripGallery } from "@/app/(staff)/staff/_components/ui/Strip.gallery";
import { alertGallery } from "@/app/(staff)/staff/_components/ui/Alert.gallery";
import { breadcrumbGallery } from "@/app/(staff)/staff/_components/ui/Breadcrumb.gallery";
import { emptyGallery } from "@/app/(staff)/staff/_components/ui/Empty.gallery";
import { rowsGallery } from "@/app/(staff)/staff/_components/ui/Rows.gallery";
import { iconTextGallery } from "@/app/(staff)/staff/_components/ui/IconText.gallery";
import { lockIconGallery } from "@/app/(staff)/staff/_components/ui/LockIcon.gallery";
import { notIconGallery } from "@/app/(staff)/staff/_components/ui/NotIcon.gallery";
import { noticeGallery } from "@/app/(staff)/staff/_components/ui/Notice.gallery";
import { sortHeadingGallery } from "@/app/(staff)/staff/_components/ui/SortHeading.gallery";
import { alertIconGallery } from "@/app/(staff)/staff/_components/ui/AlertIcon.gallery";
import { deleteTwiceGallery } from "@/app/(staff)/staff/_components/ui/DeleteTwice.gallery";
import { filterBarGallery } from "@/app/(staff)/staff/_components/ui/FilterBar.gallery";
import { savedFiltersGallery } from "@/app/(staff)/staff/_components/ui/SavedFilters.gallery";
import { filterBarLinesGallery } from "@/app/(staff)/staff/_components/ui/FilterBarLines.gallery";
import { copyButtonGallery } from "@/app/(staff)/staff/_components/ui/CopyButton.gallery";
import { choicesGallery } from "@/app/(staff)/staff/_components/ui/Choices.gallery";
import { manyChoicesGallery } from "@/app/(staff)/staff/_components/ui/ManyChoices.gallery";
import { menuGallery } from "@/app/(staff)/staff/_components/ui/Menu.gallery";
import { menuSelectGallery } from "@/app/(staff)/staff/_components/ui/MenuSelect.gallery";
import { menuSubmitGallery } from "@/app/(staff)/staff/_components/ui/MenuSubmit.gallery";
import { bubbleGallery } from "@/components/ui/Bubble.gallery";

const [grid, card, column] = gridGallery;
const [listTable, listFrame] = listFrameGallery;
const [savedFilters, savedFilterGone] = savedFiltersGallery;

export const staffKit: Group = {
  id: "staff-kit",
  title: "The staff interface: its kit",
  examples: [
    ...staffPageGallery,
    grid,
    ...numberedGallery,
    card,
    column,
    ...staffLinkGallery,
    ...externalLinkGallery,
    ...testTagGallery,
    ...formPendingGallery,
    ...navFoldGallery,
    ...navIconGallery,
    ...withheldGallery,
    ...choiceSearchGallery,
    listTable,
    ...shortenedGallery,
    ...whenGallery,
    ...tabsGallery,
    ...pageHeadGallery,
    ...pageGallery,
    ...downloadMenuGallery,
    ...bandGallery,
    ...countsGallery,
    ...progressGallery,
    ...stripGallery,
    ...staffNavGallery,
    ...alertGallery,
    ...breadcrumbGallery,
    listFrame,
    ...emptyGallery,
    ...rowsGallery,
    ...iconTextGallery,
    ...lockIconGallery,
    ...notIconGallery,
    ...noticeGallery,
    ...sortHeadingGallery,
    ...alertIconGallery,
    ...deleteTwiceGallery,
    ...filterBarGallery,
    savedFilters,
    ...filterBarLinesGallery,
    savedFilterGone,
    ...copyButtonGallery,
    ...choicesGallery,
    ...manyChoicesGallery,
    ...menuGallery,
    ...menuSelectGallery,
    ...menuSubmitGallery,
    ...bubbleGallery,
  ],
};
