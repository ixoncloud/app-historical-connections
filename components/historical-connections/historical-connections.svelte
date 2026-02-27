<script lang="ts">
  import type { ComponentContext } from "@ixon-cdk/types";
  import { onMount } from "svelte";
  import type { HistoricalConnection } from "./models/historical-connection";
  import { ApiService } from "./services/api.service";

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
  let sortDirection: "asc" | "desc" = "asc";
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
    { id: "startDate", name: "START_DATE" },
    { id: "endDate", name: "END_DATE" },
    { id: "duration", name: "DURATION" },
  ];

  let historicalConnections: HistoricalConnection[] = [];
  let tableWidth = 0;
  let tableScrollTop = 0;
  let searchPlaceholderString = "Search";
  let titleString = "Active Connections";

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

  // $: sortedConnections = [...filteredConnections].sort((a, b) => {
  //   let aValue: string | number = a[sortColumn]!;
  //   let bValue: string | number = b[sortColumn]!;

  //   if (sortColumn === "duration") {
  //     aValue = a["durationMillis"];
  //     bValue = b["durationMillis"];
  //   } else if (sortColumn === "startDate") {
  //     aValue = a["startDateMillis"];
  //     bValue = b["startDateMillis"];
  //   } else if (sortColumn === "endDate") {
  //     aValue = a["endDateMillis"];
  //     bValue = b["endDateMillis"];
  //   }

  //   if (!aValue || !bValue) {
  //     return 0;
  //   }

  //   if (typeof aValue === "string" && typeof bValue === "string") {
  //     aValue = aValue.toLowerCase();
  //     bValue = bValue.toLowerCase();
  //   }

  //   if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
  //   if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
  //   return 0;
  // });

  let sortedConnections: HistoricalConnection[] = [];
  $: {
    console.log("start sort");
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
    apiService.getActiveConnections().then((connections) => {
      historicalConnections = connections;
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

  onMount(() => {
    const client = context.createResourceDataClient();
    const apiService = new ApiService(context);

    searchPlaceholderString = context.translate("SEARCH", undefined, {
      source: "global",
    });
    titleString = context.translate("HISTORICAL_CONNECTIONS", undefined, {
      source: "global",
    });
    // If no translation is found, default to english
    // TODO: Remove this once the translation is available in production
    if (titleString === "HISTORICAL_CONNECTIONS") {
      titleString = "Historical Connections";
    }

    // Get the connections immediately
    getActiveConnections(apiService);

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
          placeholder={searchPlaceholderString}
          bind:value={search}
        />
      </div>
    </div>
    <div class="card-content">
      {#if tableScrollTop > 0}
        <div class="table-header-drop-shadow" style="width: {tableWidth}px" />
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
                        showTooltipIfEllipsed(
                          e,
                          String(
                            column.id !== "duration"
                              ? connection[column.id]
                              : connection["durationString"],
                          ),
                        )}
                    >
                      <a
                        title={column.id !== "duration"
                          ? connection[column.id]
                          : connection["durationString"]}
                        href={column.id === "userEmail" &&
                        connection[column.id] !== "-"
                          ? `mailto:${connection[column.id]}`
                          : column.id === "agentName" &&
                              connection[column.id] !== "-"
                            ? `${getCompanyUrl() + column.navigationUrl + connection.agentId}`
                            : undefined}
                        class:hasNavigationUrl={connection[column.id] !== "-" &&
                          (!!column.navigationUrl || column.id === "userEmail")}
                        >{column.id !== "duration"
                          ? connection[column.id]
                          : connection["durationString"]}</a
                      >
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="no-active-connections">No active connections</div>
      {/if}
    </div>
  </div>
</main>

<style lang="scss">
  @use "./styles/card" as card;
  @use "./styles/table" as table;
  @use "./styles/search-input" as searchInput;
  @use "./styles/sort" as sort;
  $heading-color: #005014;

  main {
    height: 100%;
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

  .no-active-connections {
    font-size: 14px;
    margin-bottom: 16px;
  }
</style>
