<script lang="ts">
  import type { ComponentContext, ComponentInput } from "@ixon-cdk/types";
  import { onMount, tick } from "svelte";
  import type { HistoricalConnection } from "./models/historical-connection";
  import { ApiService } from "./services/api.service";
  import { ParseService } from "./services/parse.service";

  type Column =
    | "userName"
    | "userEmail"
    | "agentName"
    | "startDate"
    | "endDate"
    | "duration";

  export let context: ComponentContext;
  let search = "";
  let sortColumn: Column = "endDate";
  let sortDirection: "asc" | "desc" = "desc";
  let columns: {
    id: Column;
    name: string;
    navigationUrl?: string;
  }[] = [
    { id: "userName", name: "USER" },
    { id: "userEmail", name: "EMAIL" },
    {
      id: "agentName",
      name: "ROUTER",
      navigationUrl: "/fleet-manager/device-configurator/",
    },
    // TODO: Check why translation is not working
    { id: "startDate", name: "Start date" },
    { id: "endDate", name: "END_DATE" },
    { id: "duration", name: "DURATION" },
  ];

  let historicalConnections: HistoricalConnection[] = [];
  let tableWidth = 0;
  let tableScrollTop = 0;
  let titleString = "Active Connections";

  let fromDate: string = "";
  let toDate: string = "";
  let isLoading = false;
  let itemsCollected = 0;
  let isStructuring = false;

  $: filteredConnections = search
    ? historicalConnections.filter((connection) => {
        const s = search.toLowerCase();
        return (
          connection.userName?.toLowerCase().includes(s) ||
          connection.agentName?.toLowerCase().includes(s) ||
          connection.userEmail?.toLowerCase().includes(s)
        );
      })
    : historicalConnections;
  // $: isNarrow = tableWidth < 320; Maybe for later

  let sortedConnections: HistoricalConnection[] = [];
  $: {
    const result = [...filteredConnections].sort((a, b) => {
      let aValue: string | number = a[sortColumn]!;
      let bValue: string | number = b[sortColumn]!;

      if (sortColumn === "duration") {
        aValue = a["durationMillis"];
        bValue = b["durationMillis"];
      } else if (sortColumn === "startDate") {
        aValue = a["startDateMillis"];
        bValue = b["startDateMillis"];
      } else if (sortColumn === "endDate") {
        aValue = a["endDateMillis"];
        bValue = b["endDateMillis"];
      }

      if (!aValue || !bValue) return 0;

      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    sortedConnections = result;
    console.log("Sort finished");
  }

  /**
   * Ensures the sorting arrow is correctly positioned
   * Resets to duration
   */
  function handleSort(column: typeof sortColumn) {
    if (sortColumn !== column) {
      sortColumn = column;
      sortDirection = "desc";
    } else if (sortDirection === "asc") {
      sortDirection = "desc";
    } else {
      sortDirection = "asc";
    }
  }

  function handleTableScroll(event: Event): void {
    tableScrollTop = (event.target as HTMLDivElement).scrollTop;
  }

  /**
   * For the hovered item, if the text is ellipsed, show the title (tooltip)
   */
  function showTooltipIfEllipsed(event: MouseEvent, text: string) {
    const target = event.currentTarget as HTMLElement;
    if (target.scrollWidth > target.clientWidth) {
      if (!target.querySelector("a")?.hasAttribute("title")) {
        target.querySelector("a")?.setAttribute("title", text);
      }
    } else {
      if (target.querySelector("a")?.hasAttribute("title")) {
        target.querySelector("a")?.removeAttribute("title");
      }
    }
  }

  function getActiveConnections(apiService: ApiService) {
    isLoading = true;
    itemsCollected = 0;
    isStructuring = false;
    apiService
      .getActiveConnections(
        { fromDate, toDate },
        // Single progress callback covering both loading phases:
        //   'collecting'  - a batch of audit log records arrived; show the running total
        //   'structuring' - all data fetched; about to run the synchronous pairing work.
        //                   Returns a promise so the API service awaits a guaranteed
        //                   browser paint (tick() + double rAF) before blocking the thread.
        async (event) => {
          if (event.phase === "collecting") {
            itemsCollected = event.count;
          } else {
            // phase === 'structuring'
            isStructuring = true;
            // tick()                       - flushes Svelte's pending DOM updates
            // first requestAnimationFrame  - browser renders & paints the new DOM
            // second requestAnimationFrame - we resume at the start of the NEXT
            //                               frame, after the paint is complete
            await tick();
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
          }
        },
      )
      .then((connections) => {
        historicalConnections = connections;
      })
      .finally(() => {
        isLoading = false;
        isStructuring = false;
      });
  }

  /**
   * Extract the company Url from the context
   */
  function getCompanyUrl() {
    const url = context.componentBaseUrl;
    const idx = url.indexOf("/", url.indexOf("//") + 2);
    const parts = idx === -1 ? [url] : [url.slice(0, idx), url.slice(idx + 1)];
    return parts[0];
  }

  async function handleMoreActionsButtonClick(event: Event): Promise<void> {
    event.stopImmediatePropagation();
    // TODO: Add translation
    const actions = [{ type: "export", title: "Export as CSV" }];
    const target = event.target as HTMLElement;
    const result = await context.openActionMenu(target, {
      actions,
    });
    if (result) {
      const resultAction = actions[result.index];
      switch (resultAction?.type) {
        case "export":
          parseService.downloadAsCSV(sortedConnections);
          break;
      }
    }
  }

  async function openPeriodSelectionDialog() {
    const result = await context.openFormDialog({
      title: "Select period",
      inputs: [
        {
          key: "startdate",
          label: "Start date",
          type: "Date",
          required: true,
        },
        {
          key: "enddate",
          label: "End date",
          type: "Date",
          required: true,
        },
      ],
      initialValue: {
        startdate: fromDate ? fromDate : undefined,
        enddate: toDate ? toDate : undefined,
      },
      submitButtonText: "Submit",
      discardChangesPrompt: true,
    });

    if (result) {
      // en-CA so it formats as yyyy-mm-dd
      const startdate = new Date(result.value["startdate"]).toLocaleDateString(
        "en-CA",
      );
      const enddate = new Date(result.value["enddate"]).toLocaleDateString(
        "en-CA",
      );
      fromDate = startdate;
      toDate = enddate;
      getActiveConnections(apiService);
    }
  }

  let apiService: ApiService;
  let parseService = new ParseService();
  onMount(() => {
    const client = context.createResourceDataClient();
    apiService = new ApiService(context);
    parseService = new ParseService();

    // searchPlaceholderString = context.translate("SEARCH", undefined, {
    //   source: "global",
    // });
    titleString = context.translate("HISTORICAL_CONNECTIONS", undefined, {
      source: "global",
    });
    // If no translation is found, default to english
    // TODO: Remove this once the translation is available in production
    if (titleString === "HISTORICAL_CONNECTIONS") {
      titleString = "Historical Connections";
    }

    // Clear the connection when the component is no longer visible
    return () => {
      client.destroy();
    };
  });
</script>

<main>
  <div class="card">
    <div class="card-header with-actions">
      <h3 class="card-title">{titleString}</h3>

      <div class="header-actions-bar">
        <button
          class="period-select-button"
          disabled={isLoading}
          on:click={() => openPeriodSelectionDialog()}
        >
          <div class="field field-from">
            <span class="from"
              >{context.translate("FROM", undefined, {
                source: "global",
              })}</span
            >
            <span class="from-value"
              >{fromDate !== "" ? fromDate : "yyyy-mm-dd"}</span
            >
          </div>

          <div class="field field-to">
            <span class="to"
              >{context
                .translate("TO", undefined, {
                  source: "global",
                })
                .slice(0, 1)
                .toUpperCase()}{context
                .translate("TO", undefined, {
                  source: "global",
                })
                .toUpperCase()
                .slice(1)
                .toLowerCase()}</span
            >
            <span class="to-value">{toDate !== "" ? toDate : "yyyy-mm-dd"}</span
            >
          </div>
        </button>

        <div class="search-input-container">
          <div class="search-input-prefix">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path
                d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
              />
            </svg>
          </div>
          <input
            class="search-input"
            disabled={isLoading}
            placeholder={context.translate("SEARCH", undefined, {
              source: "global",
            })}
            bind:value={search}
          />
        </div>
        <div class="options-menu-button-container">
          <button
            title={context.translate("OPTIONS", undefined, {
              source: "global",
            })}
            class="options-menu-button"
            on:click={(event) => handleMoreActionsButtonClick(event)}
          >
            <svg
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="currentColor"
              ><path
                d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"
              /></svg
            >
          </button>
        </div>
      </div>
    </div>
    <div class="card-content">
      {#if tableScrollTop > 0}
        <div
          class="table-header-drop-shadow"
          style="width: {tableWidth}px"
        ></div>
      {/if}
      {#if historicalConnections.length}
        <div
          class="table-wrapper"
          bind:clientWidth={tableWidth}
          on:scroll={handleTableScroll}
        >
          <table class="base-table">
            <thead>
              <tr>
                {#each columns as column}
                  <th
                    class="column-header-cell"
                    on:click={() => handleSort(column.id)}
                  >
                    <div class="column-header">
                      <span class="column-name"
                        >{context.translate(column.name, undefined, {
                          source: "global",
                        })}</span
                      >
                      <span class="sort-arrow">
                        {#if sortColumn === column.id}
                          {#if sortDirection === "asc"}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="16px"
                              viewBox="0 -960 960 960"
                              width="24px"
                              fill="currentColor"
                              ><path
                                d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z"
                              /></svg
                            >
                          {/if}
                          {#if sortDirection === "desc"}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="16px"
                              viewBox="0 -960 960 960"
                              width="24px"
                              fill="currentColor"
                              ><path
                                d="M440-800v487L216-537l-56 57 320 320 320-320-56-57-224 224v-487h-80Z"
                              /></svg
                            >
                          {/if}
                        {/if}
                      </span>
                    </div>
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each sortedConnections as connection}
                <tr data-testid="active-connections-overview-table-row">
                  {#each columns as column}
                    <td
                      on:mouseenter={(e) =>
                        showTooltipIfEllipsed(e, String(connection[column.id]))}
                    >
                      <a
                        title={connection[column.id]}
                        href={column.id === "userEmail" &&
                        connection[column.id] !== "-"
                          ? `mailto:${connection[column.id]}`
                          : column.id === "agentName" &&
                              connection[column.id] !== "-"
                            ? `${getCompanyUrl() + column.navigationUrl + connection.agentId}`
                            : undefined}
                        class:hasNavigationUrl={connection[column.id] !== "-" &&
                          (!!column.navigationUrl || column.id === "userEmail")}
                        >{connection[column.id]}</a
                      >
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="no-historical-connections">No historical connections</div>
      {/if}
    </div>
  </div>
  {#if isLoading}
    <div class="loading-overlay" aria-busy="true" aria-label="Loading">
      <div class="spinner"></div>
      <p class="loading-count">
        {isStructuring
          ? "Structuring data..."
          : itemsCollected > 0
            ? `${itemsCollected.toLocaleString()} items collected...`
            : "\u00a0"}
      </p>
    </div>
  {/if}
</main>

<style lang="scss">
  @use "./styles/card" as card;
  @use "./styles/table" as table;
  @use "./styles/search-input" as searchInput;
  @use "./styles/sort" as sort;
  @use "./styles/spinner" as spinner;
  $heading-color: #005014;

  main {
    height: 100%;
    position: relative;
  }

  .options-menu-button-container {
    display: flex;
    align-items: center;
  }

  .csv-button,
  .options-menu-button {
    border: none;
    background: none;
    width: fit-content;
    height: fit-content;
    padding-right: 0;

    color: rgb(110, 110, 110);
    &:hover {
      color: black;
      cursor: pointer;
    }
  }

  .period-select-button {
    display: flex;
    margin-right: 0.5rem;

    background: none;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 2rem;
    cursor: pointer;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.12),
      0 1px 2px rgba(0, 0, 0, 0.08);
    transition: box-shadow 0.2s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
      box-shadow:
        0 2px 6px rgba(0, 0, 0, 0.15),
        0 2px 4px rgba(0, 0, 0, 0.1);
    }

    & .field-from {
      border-right: 1px solid #ccc;
    }

    .field {
      font-family: Roboto, "Helvetica Neue", sans-serif;
      // padding: 0.5rem 0.2rem 0.5rem 0.2rem;
      padding-left: 0.5rem;
      padding-right: 0.5rem;
      padding-top: 0.2rem;
      padding-bottom: 0.2rem;
      width: 80px;

      display: flex;
      flex-direction: column;

      & .from,
      & .to {
        font-size: 10px;
        text-align: left;
      }

      & .from-value,
      & .to-value {
        margin-left: 2px;
        border: none;
        cursor: pointer;
        background: none;
        text-align: left;
        // font-style: italic;
      }
    }
  }

  .table-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: auto;
    overflow-anchor: none;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
  }

  .no-historical-connections {
    font-size: 14px;
    margin-bottom: 16px;
  }
</style>
