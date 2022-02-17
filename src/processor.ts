import {
  FirehoseTransformationHandler,
  FirehoseTransformationResultRecord,
} from "aws-lambda";

const handler: FirehoseTransformationHandler = async ({ records }) => ({
  records: records.map(
    ({ recordId, data }): FirehoseTransformationResultRecord => ({
      recordId,
      data,
      result: "Ok",
      metadata: { partitionKeys: { serviceDay: "1970-01-01" } },
    })
  ),
});

export { handler };
