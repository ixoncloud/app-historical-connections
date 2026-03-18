import Papa from "papaparse";
import type { HistoricalConnection } from "../models/historical-connection";

export class ParseService {
  listToCsv(list: HistoricalConnection[]): string {
    const csvString = Papa.unparse(list);
    return csvString;
  }

  listToJson(list: []): string {
    return "";
  }

  jsonToCsv(json: string): string {
    return "";
  }

  exportCsv(csv: string) {}

  downloadAsCSV(data: HistoricalConnection[], fileName: string = "export.csv") {
    const csvString = Papa.unparse(data);

    // Create a Blob with the CSV content and correct MIME type
    // Use '\ufeff' (BOM) to ensure Excel recognizes UTF-8 characters (like € or accents)
    const blob = new Blob(["\ufeff" + csvString], {
      type: "text/csv;charset=utf-8;",
    });

    // Create a temporary hidden link element
    const link = document.createElement("a");
    // Create a URL for the Blob and set it as the link's destination
    const url = URL.createObjectURL(blob);
    link.href = url;
    // Set the download attribute with the desired filename
    link.setAttribute("download", fileName);
    // Append to body, click it, and remove it immediately
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Clean up the URL object to free up memory
    URL.revokeObjectURL(url);
  }
}
