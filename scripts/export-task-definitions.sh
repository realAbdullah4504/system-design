#!/bin/bash

mkdir -p export/ecs

CLUSTERS=$(aws ecs list-clusters --query "clusterArns[]" --output text)

for C in $CLUSTERS; do
  CLUSTER_NAME=$(basename $C)

  SERVICES=$(aws ecs list-services \
    --cluster $C \
    --query "serviceArns[]" \
    --output text)

  for S in $SERVICES; do
    SERVICE_NAME=$(basename $S)

    aws ecs describe-services \
      --cluster $C \
      --services $S \
      > export/ecs/${CLUSTER_NAME}_${SERVICE_NAME}.json
  done
done