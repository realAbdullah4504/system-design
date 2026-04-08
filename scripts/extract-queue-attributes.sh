#!/bin/bash

mkdir -p export/sqs

QUEUES=$(aws sqs list-queues --query "QueueUrls[]" --output text)

for Q in $QUEUES; do
  NAME=$(basename $Q)

  aws sqs get-queue-attributes \
    --queue-url $Q \
    --attribute-names All \
    > export/sqs/$NAME.json
done