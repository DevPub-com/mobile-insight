export type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

export type GoogleAnalyticsValue = {
  value?: string;
};

export type GoogleAnalyticsReportRow = {
  dimensionValues?: GoogleAnalyticsValue[];
  metricValues?: GoogleAnalyticsValue[];
};

export type GoogleAnalyticsReportResponse = {
  rows?: GoogleAnalyticsReportRow[];
  rowCount?: number;
  metadata?: {
    dataLossFromOtherRow?: boolean;
    subjectToThresholding?: boolean;
    timeZone?: string;
    samplingMetadatas?: Array<{
      samplesReadCount?: string;
      samplingSpaceSize?: string;
    }>;
  };
};
