import type { ComponentContext } from "@ixon-cdk/types";
import type { Agent } from "../models/agent";
import type { User } from "../models/user";
import type { HistoricalConnection } from "../models/historical-connection";
import { format, formatDistance, formatDistanceToNow } from "date-fns";
import * as locale from 'date-fns/locale'
import type { AuditLog } from "../models/audit-log";
import type { ConnectionEvent } from "../models/connectionEvent";

export class ApiService {
  context: ComponentContext;
  headers: Record<string, string>;

  constructor(context: ComponentContext) {
    this.context = context;
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + this.context.appData.accessToken.secretId,
      'Api-Application': this.context.appData.apiAppId,
      'Api-Company': this.context.appData.company.publicId,
      'Api-Version': '2',
    };
  }

  /**
   * The amount of audit logs being collected for each agent
   * ! CAREFUL: This can get out of hand quickly if you're dealing with hundreds of agents (= hundreds of requests)
   */
  createAgentAuditlogUrl(agentId: string) {
    const from = '2026-01-01T00:00:00Z';
    const to = '2026-01-15T00:00:00Z';
    return this.context.getApiUrl("AgentAuditLogList", {
      agentId,
      "page-size": "500",
      filters: `in(target,"AgentConnectedUser","AgentDisconnectedUser")&filters=between(time,"${from}","${to}")`
    });
  }

  createAuditlogUrl() {
    const from = '2026-01-10T00:00:00Z';
    const to = '2026-01-15T00:00:00Z';
    return this.context.getApiUrl("AuditLogList", {
      "page-size": "4000",
      filters: `in(target,"AgentConnectedUser","AgentDisconnectedUser")&filters=between(time,"${from}","${to}")`
    });
  }

  /**
   * Collects a subset of data
   * If there is more, keep collecting until you have them all
   */
  private async fetchAllPaginated<T>(urlWithParams: string, options: RequestInit): Promise<T[]> {
    let allItems: T[] = [];
    let moreAfter: string | undefined = undefined;
    const baseParams = new URL(urlWithParams).searchParams;
    const baseUrl = urlWithParams.split('?')[0];

    do {
      let url = new URL(baseUrl);
      baseParams.forEach((value, key) => url.searchParams.append(key, value));
      if (moreAfter) {
        url.searchParams.append('page-after', moreAfter);
      }

      const res = await fetch(url.toString(), options);
      const data = await res.json();
      allItems = allItems.concat(data.data || []);
      if (data.moreAfter === moreAfter) break;
      moreAfter = data.moreAfter;
    } while (moreAfter);

    return allItems;
  }

  /**
   * Retrieves all active connections
   */
  async getActiveConnections(): Promise<HistoricalConnection[]> {
    const usersUrl = this.context.getApiUrl("UserList", {
      "page-size": "4000",
      fields: "publicId, name, emailAddress",
    });

    const agentsUrl = this.context.getApiUrl("AgentList", {
      "page-size": "4000",
      fields:
        "name,activeStatus,activeVpnSession.rscServer.name,activeVpnSession.rscServer.publicId,activeVpnSession.rscServer.supportedLayers,activeVpnSession.vpnAddress, activeVpnSession.startedOn, vpnChangedOn, connectedUsers",
    });
    const options = { method: "GET", headers: this.headers };

    return await Promise.all([
      this.fetchAllPaginated<Agent>(agentsUrl, options),
      this.fetchAllPaginated<User>(usersUrl, options),
    ]).then(async ([agents, users]) => {
      // const agentsWithConnections: Agent[] = agents.filter((a: Agent) => a.connectedUsers.length > 0);

      const results: ConnectionEvent[] = (await this.fetchAllPaginated<AuditLog>(this.createAuditlogUrl(), options)).map(auditlog => {
        return {
          agentId: auditlog.topic.agent,
          event: auditlog.target,
          time: auditlog.time,
          user: auditlog.after[0].user,
        }
      });
      const connectionPairs = this.createConnectionPairs(results);

      let historicalConnections: HistoricalConnection[] = [];

      for(let i = 0; i < connectionPairs.length; i++) {
        const pair = connectionPairs[i];
        historicalConnections = [
            ...historicalConnections,
            {
              userName: pair.connection.user.name,
              userId: pair.connection.user.publicId,
              userEmail: users.find(user => user.publicId === pair.connection.user.publicId)?.emailAddress ?? '-' ,
              agentId: pair.connection.agentId,
              agentName: agents.find(agent => agent.publicId === pair.connection.agentId)?.name ?? '-' ,
              startDate: this.getDateTimeString(pair.connection.time),
              startDateMillis: this.getDistanceFromNowInMilliseconds(pair.connection.time),
              endDate: this.getDateTimeString(pair.disconnection.time),
              endDateMillis: this.getDistanceFromNowInMilliseconds(pair.disconnection.time),
              duration: "", // Just for sorting logic
              durationString: this.getDistanceString(pair.connection.time, pair.disconnection.time),
              durationMillis: this.getDistanceInMilliseconds(pair.connection.time, pair.disconnection.time),
            },
          ];
      }
      return historicalConnections;
    });
  }

  /**
   * Forms pairs between all retrieved connections and disconnections
   * 
   * NOTE:
   * Unmatched items either started before the period, ended after the period, or are still ongoing
   * Also doesn't catch connections that were made before the period, and ended after the period
   */
  createConnectionPairs(connectionEvents: ConnectionEvent[]) {
    const pairs: {connection: ConnectionEvent, disconnection: ConnectionEvent}[] = [];
    const unmatchedItems: ConnectionEvent[] = [];
    const connectionDict: { [id:string]: ConnectionEvent } = {};
    
    for(let i = connectionEvents.length - 1; i >= 0; i--) {
      const connectionEvent = connectionEvents[i];
      if(connectionEvent.event === "AgentConnectedUser") {
        connectionDict[connectionEvent.agentId + ':' + connectionEvent.user.publicId] = connectionEvent;
      } else {
        const matchingConnection: ConnectionEvent | undefined = connectionDict[connectionEvent.agentId + ':' + connectionEvent.user.publicId];
        if(matchingConnection) {
          pairs.push({connection: matchingConnection, disconnection: connectionEvent});
          delete connectionDict[connectionEvent.agentId + ':' + connectionEvent.user.publicId];
        } else {
          unmatchedItems.push(connectionEvent);
        }
      }
    }

    for (const key in connectionDict) {
      if (Object.prototype.hasOwnProperty.call(connectionDict, key)) {
        unmatchedItems.push(connectionDict[key]);
      }
    }

    return pairs;
  }


  /**
   * Converts a datetime string to something that is more readable
   */
  getDateTimeString(datetime: string) {
    if (!datetime) {
      return "Invalid datetime";
    }
    const date = new Date(datetime);
    const languageKey = (this.context.appData.language).replace('-','') as keyof typeof locale;
    const localeKey = (this.context.appData.locale).replace('-','') as keyof typeof locale;
    // First try the language, then the locale, otherwise default to English (GB)
    const selectedLocale = (locale[languageKey] as locale.Locale) ?? (locale[localeKey] as locale.Locale) ??  locale["enGB"];
    const dateTimeString = format(date,'HH:mm dd/MM/yyyy', {
      locale: selectedLocale,
    });

    return dateTimeString;
  }

  /**
   * Takes the datetime strings, and converts into a distance string ('35 minutes')
   */
  getDistanceString(from: string, to:string): string {
    if (!from || !to) {
      return "Invalid datetimes";
    }

    // Convert the ISO string into a JavaScript Date object
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const languageKey = (this.context.appData.language).replace('-','') as keyof typeof locale;
    const localeKey = (this.context.appData.locale).replace('-','') as keyof typeof locale;
    // First try the language, then the locale, otherwise default to English (GB)
    const selectedLocale = (locale[languageKey] as locale.Locale) ?? (locale[localeKey] as locale.Locale) ??  locale["enGB"];
    const distance = formatDistance(toDate, fromDate, {
      addSuffix: false, // Removes 'ago' or 'from now'
      includeSeconds: true,
      locale: selectedLocale,
    });

    return distance;
  }

  /**
   * Returns the distance in milliseconds
   * Used for determining the order of the durations 
   */
  getDistanceInMilliseconds(from: string, to:string) {
    if (!from || !to) {
      return 0;
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const differenceMs = toDate.getTime() - fromDate.getTime();
    return differenceMs;
  }

    /**
   * Returns the distance to the present in milliseconds
   * Used for determining the order of the durations 
   */
  getDistanceFromNowInMilliseconds(datetimeString: string) {
    if (!datetimeString) {
      return 0;
    }
    const dateToCompare = new Date(datetimeString);
    const now = new Date();

    // Get the difference between now and when the connection was created
    const differenceMs = now.getTime() - dateToCompare.getTime();
    return differenceMs;
  }
}