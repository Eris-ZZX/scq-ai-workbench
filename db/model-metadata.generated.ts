// Generated from the retired model during the Drizzle cut-over.
// Runtime metadata for the compatibility-preserving Drizzle repository.
export const modelMetadata = {
  "User": {
    "table": "users",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "username": {
        "column": "username",
        "type": "String",
        "nullable": false
      },
      "displayName": {
        "column": "display_name",
        "type": "String",
        "nullable": true
      },
      "passwordHash": {
        "column": "password_hash",
        "type": "String",
        "nullable": false
      },
      "email": {
        "column": "email",
        "type": "String",
        "nullable": true
      },
      "avatar": {
        "column": "avatar",
        "type": "String",
        "nullable": true
      },
      "platformRole": {
        "column": "platform_role",
        "type": "String",
        "nullable": false
      },
      "role": {
        "column": "role",
        "type": "String",
        "nullable": false
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      },
      "externalSource": {
        "column": "external_source",
        "type": "String",
        "nullable": true
      },
      "externalId": {
        "column": "external_id",
        "type": "String",
        "nullable": true
      },
      "dingtalkUserId": {
        "column": "dingtalk_user_id",
        "type": "String",
        "nullable": true
      },
      "supervisorDingtalkUserId": {
        "column": "supervisor_dingtalk_user_id",
        "type": "String",
        "nullable": true
      },
      "supervisorName": {
        "column": "supervisor_name",
        "type": "String",
        "nullable": true
      },
      "directoryUserId": {
        "column": "directory_user_id",
        "type": "String",
        "nullable": true
      },
      "directorySupervisorUserId": {
        "column": "directory_supervisor_user_id",
        "type": "String",
        "nullable": true
      },
      "directorySupervisorName": {
        "column": "directory_supervisor_name",
        "type": "String",
        "nullable": true
      },
      "syncAt": {
        "column": "sync_at",
        "type": "DateTime",
        "nullable": true
      },
      "unionid": {
        "column": "unionid",
        "type": "String",
        "nullable": true
      },
      "phoneNumber": {
        "column": "phone_number",
        "type": "String",
        "nullable": true
      },
      "phoneNumberVerified": {
        "column": "phone_number_verified",
        "type": "Boolean",
        "nullable": true
      },
      "emailVerified": {
        "column": "email_verified",
        "type": "Boolean",
        "nullable": true
      },
      "address": {
        "column": "address",
        "type": "String",
        "nullable": true
      },
      "birthdate": {
        "column": "birthdate",
        "type": "String",
        "nullable": true
      },
      "gender": {
        "column": "gender",
        "type": "String",
        "nullable": true
      },
      "locale": {
        "column": "locale",
        "type": "String",
        "nullable": true
      },
      "nickname": {
        "column": "nickname",
        "type": "String",
        "nullable": true
      },
      "preferredUsername": {
        "column": "preferred_username",
        "type": "String",
        "nullable": true
      },
      "profile": {
        "column": "profile",
        "type": "String",
        "nullable": true
      },
      "website": {
        "column": "website",
        "type": "String",
        "nullable": true
      },
      "zoneinfo": {
        "column": "zoneinfo",
        "type": "String",
        "nullable": true
      },
      "externalIdAuthing": {
        "column": "external_id_authing",
        "type": "String",
        "nullable": true
      },
      "extendedFields": {
        "column": "extended_fields",
        "type": "String",
        "nullable": true
      },
      "tenantId": {
        "column": "tenant_id",
        "type": "String",
        "nullable": true
      },
      "userpoolId": {
        "column": "userpool_id",
        "type": "String",
        "nullable": true
      },
      "roles": {
        "column": "roles",
        "type": "String",
        "nullable": true
      }
    },
    "relations": {
      "identities": {
        "model": "UserIdentity",
        "list": true,
        "nullable": false,
        "relationName": "UserToUserIdentity",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "projectMembers": {
        "model": "ProjectMember",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "createdTasks": {
        "model": "Task",
        "list": true,
        "nullable": false,
        "relationName": "TaskCreator",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "creatorId"
        ]
      },
      "closedActivityParents": {
        "model": "ProjectActivityParent",
        "list": true,
        "nullable": false,
        "relationName": "ActivityParentCloser",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "closedById"
        ]
      },
      "positionBinding": {
        "model": "UserPosition",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "projectPositionAssignments": {
        "model": "ProjectPositionAssignment",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "assignedActivityChildren": {
        "model": "ProjectActivityChild",
        "list": true,
        "nullable": false,
        "relationName": "ActivityChildAssignee",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "assigneeUserId"
        ]
      },
      "returnedActivityChildren": {
        "model": "ProjectActivityChild",
        "list": true,
        "nullable": false,
        "relationName": "ActivityChildReturner",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "returnedById"
        ]
      },
      "uploadedActivityAttachments": {
        "model": "ActivityAttachment",
        "list": true,
        "nullable": false,
        "relationName": "ActivityAttachmentUploader",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "uploadedById"
        ]
      },
      "deletedActivityAttachments": {
        "model": "ActivityAttachment",
        "list": true,
        "nullable": false,
        "relationName": "ActivityAttachmentDeleter",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "deletedById"
        ]
      },
      "notifications": {
        "model": "Notification",
        "list": true,
        "nullable": false,
        "relationName": "NotificationRecipient",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "recipientUserId"
        ]
      },
      "createdNotifications": {
        "model": "Notification",
        "list": true,
        "nullable": false,
        "relationName": "NotificationCreator",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "createdById"
        ]
      },
      "activityEvents": {
        "model": "ActivityEvent",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "actorUserId"
        ]
      },
      "events": {
        "model": "ObservabilityEvent",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "aiResourceMembership": {
        "model": "AiResourceMembership",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "aiResourcesCreated": {
        "model": "AiResource",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceCreator",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "createdById"
        ]
      },
      "aiResourcesOwned": {
        "model": "AiResource",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceOwner",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "ownerId"
        ]
      },
      "aiResourceReviewsRequested": {
        "model": "AiResourceReviewRequest",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceReviewRequester",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "requesterId"
        ]
      },
      "aiResourceReviewsHandled": {
        "model": "AiResourceReviewRequest",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceReviewReviewer",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "reviewerId"
        ]
      },
      "aiResourceUpdateLogsAsActor": {
        "model": "AiResourceUpdateLog",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceUpdateActor",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "actorId"
        ]
      },
      "aiResourceUpdateLogsAsReviewer": {
        "model": "AiResourceUpdateLog",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceUpdateReviewer",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "reviewerId"
        ]
      },
      "aiResourceFavorites": {
        "model": "AiResourceFavorite",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "aiResourceFavoriteTags": {
        "model": "AiResourceFavoriteTag",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "aiResourceLikes": {
        "model": "AiResourceLike",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "aiResourceComments": {
        "model": "AiResourceComment",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      },
      "aiResourceRoleAuditsAsSubject": {
        "model": "AiResourceRoleAudit",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceRoleAuditSubject",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "subjectUserId"
        ]
      },
      "aiResourceRoleAuditsAsActor": {
        "model": "AiResourceRoleAudit",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceRoleAuditActor",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "actorId"
        ]
      },
      "aiResourceMembershipUpdates": {
        "model": "AiResourceMembership",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceMembershipUpdater",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "updatedById"
        ]
      },
      "aiResourceMigrationRuns": {
        "model": "AiResourceMigrationRun",
        "list": true,
        "nullable": false,
        "relationName": "AiResourceMigrationOperator",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "operatorId"
        ]
      },
      "dingtalkDepartments": {
        "model": "UserDingTalkDepartment",
        "list": true,
        "nullable": false,
        "relationName": "UserToDingTalkDepartment",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "userId"
        ]
      }
    }
  },
  "Project": {
    "table": "projects",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "description": {
        "column": "description",
        "type": "String",
        "nullable": true
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "completedAt": {
        "column": "completed_at",
        "type": "DateTime",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      },
      "externalSource": {
        "column": "external_source",
        "type": "String",
        "nullable": true
      },
      "externalId": {
        "column": "external_id",
        "type": "String",
        "nullable": true
      },
      "syncAt": {
        "column": "sync_at",
        "type": "DateTime",
        "nullable": true
      },
      "startDate": {
        "column": "start_date",
        "type": "DateTime",
        "nullable": true
      },
      "expectedEndDate": {
        "column": "expected_end_date",
        "type": "DateTime",
        "nullable": true
      },
      "currentStage": {
        "column": "current_stage",
        "type": "String",
        "nullable": false
      },
      "currentStageStartedAt": {
        "column": "current_stage_started_at",
        "type": "DateTime",
        "nullable": true
      },
      "stageGateStatus": {
        "column": "stage_gate_status",
        "type": "String",
        "nullable": false
      }
    },
    "relations": {
      "members": {
        "model": "ProjectMember",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "stages": {
        "model": "ProjectStage",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "tasks": {
        "model": "Task",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "positionAssignments": {
        "model": "ProjectPositionAssignment",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "activitySnapshotMeta": {
        "model": "ProjectActivitySnapshotMeta",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "activityParents": {
        "model": "ProjectActivityParent",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "activityChildren": {
        "model": "ProjectActivityChild",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "activityAttachments": {
        "model": "ActivityAttachment",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "notifications": {
        "model": "Notification",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "stageGateRecords": {
        "model": "StageGateRecord",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "trialPlanNodes": {
        "model": "ProjectTrialPlanNode",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "activityEvents": {
        "model": "ActivityEvent",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      },
      "events": {
        "model": "ObservabilityEvent",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "projectId"
        ]
      }
    }
  },
  "ProjectMember": {
    "table": "project_members",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "role": {
        "column": "role",
        "type": "String",
        "nullable": false
      },
      "assignedRole": {
        "column": "assigned_role",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "assignedTasks": {
        "model": "Task",
        "list": true,
        "nullable": false,
        "relationName": "TaskAssignee",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "assigneeMemberId"
        ]
      }
    }
  },
  "ProjectRole": {
    "table": "project_roles",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "code": {
        "column": "code",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "isActive": {
        "column": "is_active",
        "type": "Boolean",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {}
  },
  "PositionRole": {
    "table": "position_roles",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "roleName": {
        "column": "role_name",
        "type": "String",
        "nullable": true
      },
      "description": {
        "column": "description",
        "type": "String",
        "nullable": true
      },
      "isActive": {
        "column": "is_active",
        "type": "Boolean",
        "nullable": false
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "userPositions": {
        "model": "UserPosition",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "positionRoleId"
        ]
      },
      "projectAssignments": {
        "model": "ProjectPositionAssignment",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "positionRoleId"
        ]
      },
      "templateChildren": {
        "model": "ActivityTemplateChild",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "responsibleRoleId"
        ]
      },
      "activityChildren": {
        "model": "ProjectActivityChild",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "responsibleRoleId"
        ]
      }
    }
  },
  "UserPosition": {
    "table": "user_positions",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "positionRoleId": {
        "column": "position_role_id",
        "type": "String",
        "nullable": false
      },
      "effectiveAt": {
        "column": "effective_at",
        "type": "DateTime",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "positionRole": {
        "model": "PositionRole",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "positionRoleId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "ProjectPositionAssignment": {
    "table": "project_position_assignments",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "positionRoleId": {
        "column": "position_role_id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "appointedById": {
        "column": "appointed_by_id",
        "type": "String",
        "nullable": true
      },
      "note": {
        "column": "note",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "positionRole": {
        "model": "PositionRole",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "positionRoleId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "StageTemplate": {
    "table": "stage_templates",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "description": {
        "column": "description",
        "type": "String",
        "nullable": true
      },
      "order": {
        "column": "order",
        "type": "Int",
        "nullable": false
      },
      "isDefault": {
        "column": "is_default",
        "type": "Boolean",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {}
  },
  "ProjectStage": {
    "table": "project_stages",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "description": {
        "column": "description",
        "type": "String",
        "nullable": true
      },
      "order": {
        "column": "order",
        "type": "Int",
        "nullable": false
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "blockedReason": {
        "column": "blocked_reason",
        "type": "String",
        "nullable": true
      },
      "completedAt": {
        "column": "completed_at",
        "type": "DateTime",
        "nullable": true
      },
      "startDate": {
        "column": "start_date",
        "type": "DateTime",
        "nullable": true
      },
      "endDate": {
        "column": "end_date",
        "type": "DateTime",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "tasks": {
        "model": "Task",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "stageId"
        ]
      }
    }
  },
  "ActivityTemplateSet": {
    "table": "activity_template_sets",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "code": {
        "column": "code",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "description": {
        "column": "description",
        "type": "String",
        "nullable": true
      },
      "isBuiltIn": {
        "column": "is_built_in",
        "type": "Boolean",
        "nullable": false
      },
      "isActive": {
        "column": "is_active",
        "type": "Boolean",
        "nullable": false
      },
      "latestPublishedVersionId": {
        "column": "latest_published_version_id",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "latestPublishedVersion": {
        "model": "ActivityTemplateVersion",
        "list": false,
        "nullable": true,
        "relationName": "LatestPublishedTemplateVersion",
        "localFields": [
          "latestPublishedVersionId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "versions": {
        "model": "ActivityTemplateVersion",
        "list": true,
        "nullable": false,
        "relationName": "TemplateSetVersions",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "templateSetId"
        ]
      },
      "projectSnapshots": {
        "model": "ProjectActivitySnapshotMeta",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "templateSetId"
        ]
      }
    }
  },
  "ActivityTemplateVersion": {
    "table": "activity_template_versions",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "templateSetId": {
        "column": "template_set_id",
        "type": "String",
        "nullable": false
      },
      "version": {
        "column": "version",
        "type": "Int",
        "nullable": false
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "sourceVersionId": {
        "column": "source_version_id",
        "type": "String",
        "nullable": true
      },
      "publishedAt": {
        "column": "published_at",
        "type": "DateTime",
        "nullable": true
      },
      "publishedById": {
        "column": "published_by_id",
        "type": "String",
        "nullable": true
      },
      "notes": {
        "column": "notes",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "templateSet": {
        "model": "ActivityTemplateSet",
        "list": false,
        "nullable": false,
        "relationName": "TemplateSetVersions",
        "localFields": [
          "templateSetId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "latestForSet": {
        "model": "ActivityTemplateSet",
        "list": false,
        "nullable": true,
        "relationName": "LatestPublishedTemplateVersion",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "latestPublishedVersionId"
        ]
      },
      "stages": {
        "model": "ActivityTemplateStage",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "versionId"
        ]
      },
      "projectSnapshots": {
        "model": "ProjectActivitySnapshotMeta",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "templateVersionId"
        ]
      }
    }
  },
  "ActivityTemplateStage": {
    "table": "activity_template_stages",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "versionId": {
        "column": "version_id",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "plannedStartOffsetDays": {
        "column": "planned_start_offset_days",
        "type": "Int",
        "nullable": true
      },
      "plannedDueOffsetDays": {
        "column": "planned_due_offset_days",
        "type": "Int",
        "nullable": true
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "version": {
        "model": "ActivityTemplateVersion",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "versionId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "parents": {
        "model": "ActivityTemplateParent",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "stageId"
        ]
      }
    }
  },
  "ActivityTemplateParent": {
    "table": "activity_template_parents",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "stageId": {
        "column": "stage_id",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "description": {
        "column": "description",
        "type": "String",
        "nullable": true
      },
      "closureStandard": {
        "column": "closure_standard",
        "type": "String",
        "nullable": true
      },
      "plannedStartOffsetDays": {
        "column": "planned_start_offset_days",
        "type": "Int",
        "nullable": true
      },
      "plannedOffsetDays": {
        "column": "planned_offset_days",
        "type": "Int",
        "nullable": true
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "stage": {
        "model": "ActivityTemplateStage",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "stageId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "children": {
        "model": "ActivityTemplateChild",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "parentId"
        ]
      },
      "projectParents": {
        "model": "ProjectActivityParent",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "templateParentId"
        ]
      }
    }
  },
  "ActivityTemplateChild": {
    "table": "activity_template_children",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "parentId": {
        "column": "parent_id",
        "type": "String",
        "nullable": false
      },
      "title": {
        "column": "title",
        "type": "String",
        "nullable": false
      },
      "ownerRoleName": {
        "column": "owner_role_name",
        "type": "String",
        "nullable": false
      },
      "responsibleRoleId": {
        "column": "responsible_role_id",
        "type": "String",
        "nullable": true
      },
      "deliverableName": {
        "column": "deliverable_name",
        "type": "String",
        "nullable": true
      },
      "requiresDeliverable": {
        "column": "requires_deliverable",
        "type": "Boolean",
        "nullable": false
      },
      "requiresAttachment": {
        "column": "requires_attachment",
        "type": "Boolean",
        "nullable": false
      },
      "requiresNote": {
        "column": "requires_note",
        "type": "Boolean",
        "nullable": false
      },
      "isRequired": {
        "column": "is_required",
        "type": "Boolean",
        "nullable": false
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "parent": {
        "model": "ActivityTemplateParent",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "parentId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "responsibleRole": {
        "model": "PositionRole",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "responsibleRoleId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "projectChildren": {
        "model": "ProjectActivityChild",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "templateChildId"
        ]
      }
    }
  },
  "ProjectActivitySnapshotMeta": {
    "table": "project_activity_snapshot_metas",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "templateSetId": {
        "column": "template_set_id",
        "type": "String",
        "nullable": false
      },
      "templateVersionId": {
        "column": "template_version_id",
        "type": "String",
        "nullable": false
      },
      "generatedAt": {
        "column": "generated_at",
        "type": "DateTime",
        "nullable": false
      },
      "generatedById": {
        "column": "generated_by_id",
        "type": "String",
        "nullable": true
      },
      "localAdjustmentCount": {
        "column": "local_adjustment_count",
        "type": "Int",
        "nullable": false
      },
      "notApplicableCount": {
        "column": "not_applicable_count",
        "type": "Int",
        "nullable": false
      },
      "notes": {
        "column": "notes",
        "type": "String",
        "nullable": true
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "templateSet": {
        "model": "ActivityTemplateSet",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "templateSetId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "templateVersion": {
        "model": "ActivityTemplateVersion",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "templateVersionId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "ActivityTemplate": {
    "table": "activity_templates",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "stage": {
        "column": "stage",
        "type": "String",
        "nullable": false
      },
      "projectTaskName": {
        "column": "project_task_name",
        "type": "String",
        "nullable": false
      },
      "thirdLevelPlan": {
        "column": "third_level_plan",
        "type": "String",
        "nullable": false
      },
      "ownerRole": {
        "column": "owner_role",
        "type": "String",
        "nullable": false
      },
      "deliverableName": {
        "column": "deliverable_name",
        "type": "String",
        "nullable": true
      },
      "requiresDeliverable": {
        "column": "requires_deliverable",
        "type": "Boolean",
        "nullable": false
      },
      "sourceBatchId": {
        "column": "source_batch_id",
        "type": "String",
        "nullable": false
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "isActive": {
        "column": "is_active",
        "type": "Boolean",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {}
  },
  "ProjectActivityParent": {
    "table": "project_activity_parents",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "templateParentId": {
        "column": "template_parent_id",
        "type": "String",
        "nullable": true
      },
      "stage": {
        "column": "stage",
        "type": "String",
        "nullable": false
      },
      "projectTaskName": {
        "column": "project_task_name",
        "type": "String",
        "nullable": false
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "plannedStartDate": {
        "column": "planned_start_date",
        "type": "DateTime",
        "nullable": true
      },
      "plannedDueDate": {
        "column": "planned_due_date",
        "type": "DateTime",
        "nullable": true
      },
      "closedAt": {
        "column": "closed_at",
        "type": "DateTime",
        "nullable": true
      },
      "closedById": {
        "column": "closed_by_id",
        "type": "String",
        "nullable": true
      },
      "progressPercent": {
        "column": "progress_percent",
        "type": "Int",
        "nullable": false
      },
      "hasBlocked": {
        "column": "has_blocked",
        "type": "Boolean",
        "nullable": false
      },
      "hasOverdue": {
        "column": "has_overdue",
        "type": "Boolean",
        "nullable": false
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "templateParent": {
        "model": "ActivityTemplateParent",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "templateParentId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "closedBy": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "ActivityParentCloser",
        "localFields": [
          "closedById"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "children": {
        "model": "ProjectActivityChild",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "parentId"
        ]
      },
      "events": {
        "model": "ActivityEvent",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "parentId"
        ]
      }
    }
  },
  "ProjectActivityChild": {
    "table": "project_activity_children",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "parentId": {
        "column": "parent_id",
        "type": "String",
        "nullable": false
      },
      "templateChildId": {
        "column": "template_child_id",
        "type": "String",
        "nullable": true
      },
      "thirdLevelPlan": {
        "column": "third_level_plan",
        "type": "String",
        "nullable": false
      },
      "ownerRole": {
        "column": "owner_role",
        "type": "String",
        "nullable": false
      },
      "responsibleRoleId": {
        "column": "responsible_role_id",
        "type": "String",
        "nullable": true
      },
      "assigneeUserId": {
        "column": "assignee_user_id",
        "type": "String",
        "nullable": true
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "requiresDeliverable": {
        "column": "requires_deliverable",
        "type": "Boolean",
        "nullable": false
      },
      "requiresAttachment": {
        "column": "requires_attachment",
        "type": "Boolean",
        "nullable": false
      },
      "requiresNote": {
        "column": "requires_note",
        "type": "Boolean",
        "nullable": false
      },
      "deliverableName": {
        "column": "deliverable_name",
        "type": "String",
        "nullable": true
      },
      "deliverableUrl": {
        "column": "deliverable_url",
        "type": "String",
        "nullable": true
      },
      "completionNote": {
        "column": "completion_note",
        "type": "String",
        "nullable": true
      },
      "blockerNote": {
        "column": "blocker_note",
        "type": "String",
        "nullable": true
      },
      "isBlocked": {
        "column": "is_blocked",
        "type": "Boolean",
        "nullable": false
      },
      "isNotApplicable": {
        "column": "is_not_applicable",
        "type": "Boolean",
        "nullable": false
      },
      "notApplicableReason": {
        "column": "not_applicable_reason",
        "type": "String",
        "nullable": true
      },
      "returnedAt": {
        "column": "returned_at",
        "type": "DateTime",
        "nullable": true
      },
      "returnedById": {
        "column": "returned_by_id",
        "type": "String",
        "nullable": true
      },
      "returnReason": {
        "column": "return_reason",
        "type": "String",
        "nullable": true
      },
      "isManuallyAdded": {
        "column": "is_manually_added",
        "type": "Boolean",
        "nullable": false
      },
      "plannedDueDateOverride": {
        "column": "planned_due_date_override",
        "type": "DateTime",
        "nullable": true
      },
      "completedAt": {
        "column": "completed_at",
        "type": "DateTime",
        "nullable": true
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "parent": {
        "model": "ProjectActivityParent",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "parentId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "templateChild": {
        "model": "ActivityTemplateChild",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "templateChildId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "responsibleRole": {
        "model": "PositionRole",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "responsibleRoleId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "assignee": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "ActivityChildAssignee",
        "localFields": [
          "assigneeUserId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "returnedBy": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "ActivityChildReturner",
        "localFields": [
          "returnedById"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "attachments": {
        "model": "ActivityAttachment",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "childId"
        ]
      },
      "notifications": {
        "model": "Notification",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "childId"
        ]
      },
      "events": {
        "model": "ActivityEvent",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "childId"
        ]
      }
    }
  },
  "ActivityEvent": {
    "table": "activity_events",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "parentId": {
        "column": "parent_id",
        "type": "String",
        "nullable": true
      },
      "childId": {
        "column": "child_id",
        "type": "String",
        "nullable": true
      },
      "actorUserId": {
        "column": "actor_user_id",
        "type": "String",
        "nullable": true
      },
      "actorRole": {
        "column": "actor_role",
        "type": "String",
        "nullable": true
      },
      "actionType": {
        "column": "action_type",
        "type": "String",
        "nullable": false
      },
      "beforeValue": {
        "column": "before_value",
        "type": "String",
        "nullable": true
      },
      "afterValue": {
        "column": "after_value",
        "type": "String",
        "nullable": true
      },
      "note": {
        "column": "note",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "parent": {
        "model": "ProjectActivityParent",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "parentId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "child": {
        "model": "ProjectActivityChild",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "childId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "actor": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "actorUserId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "ActivityAttachment": {
    "table": "activity_attachments",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "childId": {
        "column": "child_id",
        "type": "String",
        "nullable": false
      },
      "fileName": {
        "column": "file_name",
        "type": "String",
        "nullable": false
      },
      "storagePath": {
        "column": "storage_path",
        "type": "String",
        "nullable": false
      },
      "mimeType": {
        "column": "mime_type",
        "type": "String",
        "nullable": true
      },
      "sizeBytes": {
        "column": "size_bytes",
        "type": "Int",
        "nullable": true
      },
      "uploadedById": {
        "column": "uploaded_by_id",
        "type": "String",
        "nullable": false
      },
      "deletedAt": {
        "column": "deleted_at",
        "type": "DateTime",
        "nullable": true
      },
      "deletedById": {
        "column": "deleted_by_id",
        "type": "String",
        "nullable": true
      },
      "deleteReason": {
        "column": "delete_reason",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "child": {
        "model": "ProjectActivityChild",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "childId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "uploadedBy": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": "ActivityAttachmentUploader",
        "localFields": [
          "uploadedById"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "deletedBy": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "ActivityAttachmentDeleter",
        "localFields": [
          "deletedById"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "Notification": {
    "table": "notifications",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "recipientUserId": {
        "column": "recipient_user_id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": true
      },
      "childId": {
        "column": "child_id",
        "type": "String",
        "nullable": true
      },
      "type": {
        "column": "type",
        "type": "String",
        "nullable": false
      },
      "title": {
        "column": "title",
        "type": "String",
        "nullable": false
      },
      "body": {
        "column": "body",
        "type": "String",
        "nullable": true
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "createdById": {
        "column": "created_by_id",
        "type": "String",
        "nullable": true
      },
      "readAt": {
        "column": "read_at",
        "type": "DateTime",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "recipient": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": "NotificationRecipient",
        "localFields": [
          "recipientUserId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "project": {
        "model": "Project",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "child": {
        "model": "ProjectActivityChild",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "childId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "createdBy": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "NotificationCreator",
        "localFields": [
          "createdById"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "StageGateRecord": {
    "table": "stage_gate_records",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "stage": {
        "column": "stage",
        "type": "String",
        "nullable": false
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "plannedStartDate": {
        "column": "planned_start_date",
        "type": "DateTime",
        "nullable": true
      },
      "plannedDueDate": {
        "column": "planned_due_date",
        "type": "DateTime",
        "nullable": true
      },
      "passedAt": {
        "column": "passed_at",
        "type": "DateTime",
        "nullable": true
      },
      "passedById": {
        "column": "passed_by_id",
        "type": "String",
        "nullable": true
      },
      "conditionReleaseNote": {
        "column": "condition_release_note",
        "type": "String",
        "nullable": true
      },
      "blockerSummary": {
        "column": "blocker_summary",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "ProjectTrialPlanNode": {
    "table": "project_trial_plan_nodes",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "item": {
        "column": "item",
        "type": "String",
        "nullable": false
      },
      "plannedStartDate": {
        "column": "planned_start_date",
        "type": "DateTime",
        "nullable": true
      },
      "plannedDueDate": {
        "column": "planned_due_date",
        "type": "DateTime",
        "nullable": true
      },
      "note": {
        "column": "note",
        "type": "String",
        "nullable": true
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "Task": {
    "table": "tasks",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "title": {
        "column": "title",
        "type": "String",
        "nullable": false
      },
      "description": {
        "column": "description",
        "type": "String",
        "nullable": true
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "priority": {
        "column": "priority",
        "type": "String",
        "nullable": false
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": false
      },
      "stageId": {
        "column": "stage_id",
        "type": "String",
        "nullable": true
      },
      "assigneeMemberId": {
        "column": "assignee_member_id",
        "type": "String",
        "nullable": true
      },
      "creatorId": {
        "column": "creator_id",
        "type": "String",
        "nullable": false
      },
      "completedAt": {
        "column": "completed_at",
        "type": "DateTime",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      },
      "externalSource": {
        "column": "external_source",
        "type": "String",
        "nullable": true
      },
      "externalId": {
        "column": "external_id",
        "type": "String",
        "nullable": true
      },
      "syncAt": {
        "column": "sync_at",
        "type": "DateTime",
        "nullable": true
      }
    },
    "relations": {
      "project": {
        "model": "Project",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "stage": {
        "model": "ProjectStage",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "stageId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "assigneeMember": {
        "model": "ProjectMember",
        "list": false,
        "nullable": true,
        "relationName": "TaskAssignee",
        "localFields": [
          "assigneeMemberId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "creator": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": "TaskCreator",
        "localFields": [
          "creatorId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "statusChanges": {
        "model": "TaskStatusChange",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "taskId"
        ]
      }
    }
  },
  "TaskStatusChange": {
    "table": "task_status_changes",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "taskId": {
        "column": "task_id",
        "type": "String",
        "nullable": false
      },
      "fromStatus": {
        "column": "from_status",
        "type": "String",
        "nullable": true
      },
      "toStatus": {
        "column": "to_status",
        "type": "String",
        "nullable": false
      },
      "changedBy": {
        "column": "changed_by",
        "type": "String",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "task": {
        "model": "Task",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "taskId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "ComponentConfig": {
    "table": "component_configs",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "path": {
        "column": "path",
        "type": "String",
        "nullable": false
      },
      "enabled": {
        "column": "enabled",
        "type": "Boolean",
        "nullable": false
      },
      "order": {
        "column": "order",
        "type": "Int",
        "nullable": false
      },
      "policy": {
        "column": "policy",
        "type": "String",
        "nullable": false
      },
      "description": {
        "column": "description",
        "type": "String",
        "nullable": true
      },
      "dependsOnId": {
        "column": "depends_on_id",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "dependsOn": {
        "model": "ComponentConfig",
        "list": false,
        "nullable": true,
        "relationName": "ComponentDependency",
        "localFields": [
          "dependsOnId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "dependedBy": {
        "model": "ComponentConfig",
        "list": true,
        "nullable": false,
        "relationName": "ComponentDependency",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "dependsOnId"
        ]
      }
    }
  },
  "ObservabilityEvent": {
    "table": "observability_events",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "traceId": {
        "column": "trace_id",
        "type": "String",
        "nullable": false
      },
      "spanId": {
        "column": "span_id",
        "type": "String",
        "nullable": true
      },
      "parentSpanId": {
        "column": "parent_span_id",
        "type": "String",
        "nullable": true
      },
      "eventType": {
        "column": "event_type",
        "type": "String",
        "nullable": false
      },
      "path": {
        "column": "path",
        "type": "String",
        "nullable": true
      },
      "method": {
        "column": "method",
        "type": "String",
        "nullable": true
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": true
      },
      "projectId": {
        "column": "project_id",
        "type": "String",
        "nullable": true
      },
      "statusCode": {
        "column": "status_code",
        "type": "Int",
        "nullable": true
      },
      "durationMs": {
        "column": "duration_ms",
        "type": "Int",
        "nullable": true
      },
      "requestBody": {
        "column": "request_body",
        "type": "String",
        "nullable": true
      },
      "responseSummary": {
        "column": "response_summary",
        "type": "String",
        "nullable": true
      },
      "errorMessage": {
        "column": "error_message",
        "type": "String",
        "nullable": true
      },
      "errorStack": {
        "column": "error_stack",
        "type": "String",
        "nullable": true
      },
      "timestamp": {
        "column": "timestamp",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "project": {
        "model": "Project",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "projectId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "AiResourceModuleSettings": {
    "table": "ai_resource_module_settings",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {}
  },
  "AiResourceMigrationRun": {
    "table": "ai_resource_migration_runs",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "reportPath": {
        "column": "report_path",
        "type": "String",
        "nullable": true
      },
      "operatorId": {
        "column": "operator_id",
        "type": "String",
        "nullable": true
      },
      "startedAt": {
        "column": "started_at",
        "type": "DateTime",
        "nullable": false
      },
      "finishedAt": {
        "column": "finished_at",
        "type": "DateTime",
        "nullable": true
      },
      "errorMessage": {
        "column": "error_message",
        "type": "String",
        "nullable": true
      }
    },
    "relations": {
      "operator": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "AiResourceMigrationOperator",
        "localFields": [
          "operatorId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "items": {
        "model": "AiResourceMigrationItem",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "runId"
        ]
      }
    }
  },
  "AiResourceMigrationItem": {
    "table": "ai_resource_migration_items",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "runId": {
        "column": "run_id",
        "type": "String",
        "nullable": false
      },
      "entityType": {
        "column": "entity_type",
        "type": "String",
        "nullable": false
      },
      "legacyId": {
        "column": "legacy_id",
        "type": "String",
        "nullable": false
      },
      "targetId": {
        "column": "target_id",
        "type": "String",
        "nullable": false
      },
      "action": {
        "column": "action",
        "type": "String",
        "nullable": false
      },
      "beforeData": {
        "column": "before_data",
        "type": "String",
        "nullable": true
      },
      "afterHash": {
        "column": "after_hash",
        "type": "String",
        "nullable": true
      }
    },
    "relations": {
      "run": {
        "model": "AiResourceMigrationRun",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "runId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "AiResource": {
    "table": "ai_resources",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "legacyId": {
        "column": "legacy_id",
        "type": "String",
        "nullable": true
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "type": {
        "column": "type",
        "type": "String",
        "nullable": false
      },
      "summary": {
        "column": "summary",
        "type": "String",
        "nullable": false
      },
      "tags": {
        "column": "tags",
        "type": "String",
        "nullable": false
      },
      "ownerName": {
        "column": "owner_name",
        "type": "String",
        "nullable": false
      },
      "ownerId": {
        "column": "owner_id",
        "type": "String",
        "nullable": false
      },
      "visibilityScope": {
        "column": "visibility_scope",
        "type": "String",
        "nullable": false
      },
      "visibleDeptIds": {
        "column": "visible_dept_ids",
        "type": "String",
        "nullable": false
      },
      "visibleUserIds": {
        "column": "visible_user_ids",
        "type": "String",
        "nullable": false
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "archivedFromStatus": {
        "column": "archived_from_status",
        "type": "String",
        "nullable": true
      },
      "resourceUrl": {
        "column": "resource_url",
        "type": "String",
        "nullable": true
      },
      "content": {
        "column": "content",
        "type": "String",
        "nullable": false
      },
      "attachments": {
        "column": "attachments",
        "type": "String",
        "nullable": true
      },
      "extension": {
        "column": "extension",
        "type": "String",
        "nullable": true
      },
      "extractedText": {
        "column": "extracted_text",
        "type": "String",
        "nullable": true
      },
      "currentVersion": {
        "column": "current_version",
        "type": "Int",
        "nullable": false
      },
      "viewCount": {
        "column": "view_count",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      },
      "createdById": {
        "column": "created_by_id",
        "type": "String",
        "nullable": false
      }
    },
    "relations": {
      "createdBy": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": "AiResourceCreator",
        "localFields": [
          "createdById"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "owner": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": "AiResourceOwner",
        "localFields": [
          "ownerId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "reviewRequests": {
        "model": "AiResourceReviewRequest",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "resourceId"
        ]
      },
      "updateLogs": {
        "model": "AiResourceUpdateLog",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "resourceId"
        ]
      },
      "favorites": {
        "model": "AiResourceFavorite",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "resourceId"
        ]
      },
      "likes": {
        "model": "AiResourceLike",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "resourceId"
        ]
      },
      "comments": {
        "model": "AiResourceComment",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "resourceId"
        ]
      }
    }
  },
  "AiResourceReviewRequest": {
    "table": "ai_resource_review_requests",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "legacyId": {
        "column": "legacy_id",
        "type": "String",
        "nullable": true
      },
      "type": {
        "column": "type",
        "type": "String",
        "nullable": false
      },
      "status": {
        "column": "status",
        "type": "String",
        "nullable": false
      },
      "resourceId": {
        "column": "resource_id",
        "type": "String",
        "nullable": true
      },
      "proposedData": {
        "column": "proposed_data",
        "type": "String",
        "nullable": false
      },
      "updateSummary": {
        "column": "update_summary",
        "type": "String",
        "nullable": false
      },
      "changedFields": {
        "column": "changed_fields",
        "type": "String",
        "nullable": false
      },
      "rejectReason": {
        "column": "reject_reason",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "reviewedAt": {
        "column": "reviewed_at",
        "type": "DateTime",
        "nullable": true
      },
      "dingtalkTodoId": {
        "column": "dingtalk_todo_id",
        "type": "String",
        "nullable": true
      },
      "dingtalkTodoUnionId": {
        "column": "dingtalk_todo_union_id",
        "type": "String",
        "nullable": true
      },
      "dingtalkReworkTodoId": {
        "column": "dingtalk_rework_todo_id",
        "type": "String",
        "nullable": true
      },
      "dingtalkReworkTodoUnionId": {
        "column": "dingtalk_rework_todo_union_id",
        "type": "String",
        "nullable": true
      },
      "externalTodoProvider": {
        "column": "external_todo_provider",
        "type": "String",
        "nullable": true
      },
      "externalTodoId": {
        "column": "external_todo_id",
        "type": "String",
        "nullable": true
      },
      "externalTodoAssigneeId": {
        "column": "external_todo_assignee_id",
        "type": "String",
        "nullable": true
      },
      "externalReworkTodoProvider": {
        "column": "external_rework_todo_provider",
        "type": "String",
        "nullable": true
      },
      "externalReworkTodoId": {
        "column": "external_rework_todo_id",
        "type": "String",
        "nullable": true
      },
      "externalReworkTodoAssigneeId": {
        "column": "external_rework_todo_assignee_id",
        "type": "String",
        "nullable": true
      },
      "requesterId": {
        "column": "requester_id",
        "type": "String",
        "nullable": false
      },
      "reviewerId": {
        "column": "reviewer_id",
        "type": "String",
        "nullable": true
      }
    },
    "relations": {
      "requester": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": "AiResourceReviewRequester",
        "localFields": [
          "requesterId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "reviewer": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "AiResourceReviewReviewer",
        "localFields": [
          "reviewerId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "resource": {
        "model": "AiResource",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "resourceId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "AppSetting": {
    "table": "app_settings",
    "fields": {
      "key": {
        "column": "key",
        "type": "String",
        "nullable": false
      },
      "value": {
        "column": "value",
        "type": "String",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedById": {
        "column": "updated_by_id",
        "type": "String",
        "nullable": true
      }
    },
    "relations": {}
  },
  "AiResourceUpdateLog": {
    "table": "ai_resource_update_logs",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "legacyId": {
        "column": "legacy_id",
        "type": "String",
        "nullable": true
      },
      "resourceId": {
        "column": "resource_id",
        "type": "String",
        "nullable": false
      },
      "actorId": {
        "column": "actor_id",
        "type": "String",
        "nullable": false
      },
      "reviewerId": {
        "column": "reviewer_id",
        "type": "String",
        "nullable": true
      },
      "reviewId": {
        "column": "review_id",
        "type": "String",
        "nullable": true
      },
      "action": {
        "column": "action",
        "type": "String",
        "nullable": false
      },
      "result": {
        "column": "result",
        "type": "String",
        "nullable": false
      },
      "updateSummary": {
        "column": "update_summary",
        "type": "String",
        "nullable": false
      },
      "changedFields": {
        "column": "changed_fields",
        "type": "String",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "resource": {
        "model": "AiResource",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "resourceId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "actor": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": "AiResourceUpdateActor",
        "localFields": [
          "actorId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "reviewer": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "AiResourceUpdateReviewer",
        "localFields": [
          "reviewerId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "AiResourceFavoriteTag": {
    "table": "ai_resource_favorite_tags",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "favorites": {
        "model": "AiResourceFavorite",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "tagId"
        ]
      }
    }
  },
  "AiResourceFavorite": {
    "table": "ai_resource_favorites",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "legacyId": {
        "column": "legacy_id",
        "type": "String",
        "nullable": true
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "resourceId": {
        "column": "resource_id",
        "type": "String",
        "nullable": false
      },
      "tagId": {
        "column": "tag_id",
        "type": "String",
        "nullable": true
      },
      "sortOrder": {
        "column": "sort_order",
        "type": "Int",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "resource": {
        "model": "AiResource",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "resourceId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "tag": {
        "model": "AiResourceFavoriteTag",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "tagId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "AiResourceLike": {
    "table": "ai_resource_likes",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "resourceId": {
        "column": "resource_id",
        "type": "String",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "resource": {
        "model": "AiResource",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "resourceId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "AiResourceComment": {
    "table": "ai_resource_comments",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "resourceId": {
        "column": "resource_id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "content": {
        "column": "content",
        "type": "String",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "resource": {
        "model": "AiResource",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "resourceId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "AiResourceMembership": {
    "table": "ai_resource_memberships",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "role": {
        "column": "role",
        "type": "String",
        "nullable": false
      },
      "updatedById": {
        "column": "updated_by_id",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": null,
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "updatedBy": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "AiResourceMembershipUpdater",
        "localFields": [
          "updatedById"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "audits": {
        "model": "AiResourceRoleAudit",
        "list": true,
        "nullable": false,
        "relationName": null,
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "membershipId"
        ]
      }
    }
  },
  "AiResourceRoleAudit": {
    "table": "ai_resource_role_audits",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "membershipId": {
        "column": "membership_id",
        "type": "String",
        "nullable": true
      },
      "subjectUserId": {
        "column": "subject_user_id",
        "type": "String",
        "nullable": true
      },
      "subjectUserIdSnapshot": {
        "column": "subject_user_id_snapshot",
        "type": "String",
        "nullable": false
      },
      "subjectUsernameSnapshot": {
        "column": "subject_username_snapshot",
        "type": "String",
        "nullable": false
      },
      "actorId": {
        "column": "actor_id",
        "type": "String",
        "nullable": true
      },
      "fromRole": {
        "column": "from_role",
        "type": "String",
        "nullable": true
      },
      "toRole": {
        "column": "to_role",
        "type": "String",
        "nullable": true
      },
      "action": {
        "column": "action",
        "type": "String",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "membership": {
        "model": "AiResourceMembership",
        "list": false,
        "nullable": true,
        "relationName": null,
        "localFields": [
          "membershipId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "subjectUser": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "AiResourceRoleAuditSubject",
        "localFields": [
          "subjectUserId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "actor": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "AiResourceRoleAuditActor",
        "localFields": [
          "actorId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "AiResourceAuditLog": {
    "table": "ai_resource_audit_logs",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "actorId": {
        "column": "actor_id",
        "type": "String",
        "nullable": true
      },
      "actorUsernameSnapshot": {
        "column": "actor_username_snapshot",
        "type": "String",
        "nullable": false
      },
      "action": {
        "column": "action",
        "type": "String",
        "nullable": false
      },
      "module": {
        "column": "module",
        "type": "String",
        "nullable": false
      },
      "targetType": {
        "column": "target_type",
        "type": "String",
        "nullable": false
      },
      "targetId": {
        "column": "target_id",
        "type": "String",
        "nullable": true
      },
      "resourceId": {
        "column": "resource_id",
        "type": "String",
        "nullable": true
      },
      "reviewId": {
        "column": "review_id",
        "type": "String",
        "nullable": true
      },
      "result": {
        "column": "result",
        "type": "String",
        "nullable": false
      },
      "reason": {
        "column": "reason",
        "type": "String",
        "nullable": true
      },
      "beforeData": {
        "column": "before_data",
        "type": "String",
        "nullable": true
      },
      "afterData": {
        "column": "after_data",
        "type": "String",
        "nullable": true
      },
      "traceId": {
        "column": "trace_id",
        "type": "String",
        "nullable": true
      },
      "ipAddress": {
        "column": "ip_address",
        "type": "String",
        "nullable": true
      },
      "userAgent": {
        "column": "user_agent",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {}
  },
  "FeedbackLog": {
    "table": "feedback_logs",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": true
      },
      "content": {
        "column": "content",
        "type": "String",
        "nullable": false
      },
      "category": {
        "column": "category",
        "type": "String",
        "nullable": false
      },
      "application": {
        "column": "application",
        "type": "String",
        "nullable": true
      },
      "pagePath": {
        "column": "page_path",
        "type": "String",
        "nullable": true
      },
      "attachments": {
        "column": "attachments",
        "type": "String",
        "nullable": false
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "FeedbackLogToUser",
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "AuthLoginLog": {
    "table": "auth_login_logs",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": true
      },
      "provider": {
        "column": "provider",
        "type": "String",
        "nullable": false
      },
      "stage": {
        "column": "stage",
        "type": "String",
        "nullable": false
      },
      "outcome": {
        "column": "outcome",
        "type": "String",
        "nullable": false
      },
      "username": {
        "column": "username",
        "type": "String",
        "nullable": true
      },
      "displayName": {
        "column": "display_name",
        "type": "String",
        "nullable": true
      },
      "errorCode": {
        "column": "error_code",
        "type": "String",
        "nullable": true
      },
      "errorMessage": {
        "column": "error_message",
        "type": "String",
        "nullable": true
      },
      "errorParams": {
        "column": "error_params",
        "type": "String",
        "nullable": false
      },
      "authingData": {
        "column": "authing_data",
        "type": "String",
        "nullable": true
      },
      "requestPath": {
        "column": "request_path",
        "type": "String",
        "nullable": true
      },
      "ipAddress": {
        "column": "ip_address",
        "type": "String",
        "nullable": true
      },
      "userAgent": {
        "column": "user_agent",
        "type": "String",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": true,
        "relationName": "AuthLoginLogToUser",
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },
  "UserIdentity": {
    "table": "user_identities",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "provider": {
        "column": "provider",
        "type": "String",
        "nullable": false
      },
      "issuer": {
        "column": "issuer",
        "type": "String",
        "nullable": false
      },
      "subject": {
        "column": "subject",
        "type": "String",
        "nullable": false
      },
      "username": {
        "column": "username",
        "type": "String",
        "nullable": true
      },
      "displayName": {
        "column": "display_name",
        "type": "String",
        "nullable": true
      },
      "email": {
        "column": "email",
        "type": "String",
        "nullable": true
      },
      "avatar": {
        "column": "avatar",
        "type": "String",
        "nullable": true
      },
      "lastLoginAt": {
        "column": "last_login_at",
        "type": "DateTime",
        "nullable": true
      },
      "lastSyncAt": {
        "column": "last_sync_at",
        "type": "DateTime",
        "nullable": true
      },
      "createdAt": {
        "column": "created_at",
        "type": "DateTime",
        "nullable": false
      },
      "updatedAt": {
        "column": "updated_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": "UserToUserIdentity",
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  },

  "DingTalkDepartment": {
    "table": "dingtalk_departments",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "name": {
        "column": "name",
        "type": "String",
        "nullable": false
      },
      "parentId": {
        "column": "parent_id",
        "type": "String",
        "nullable": true
      },
      "syncAt": {
        "column": "sync_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "userDepartments": {
        "model": "UserDingTalkDepartment",
        "list": true,
        "nullable": false,
        "relationName": "DingTalkDepartmentToUser",
        "localFields": [],
        "referenceFields": [
          "id"
        ],
        "remoteFields": [
          "departmentId"
        ]
      }
    }
  },
  "NotificationOutbox": {
    "table": "notification_outbox",
    "fields": {
      "id": { "column": "id", "type": "String", "nullable": false },
      "eventType": { "column": "event_type", "type": "String", "nullable": false },
      "payload": { "column": "payload", "type": "String", "nullable": false },
      "idempotencyKey": { "column": "idempotency_key", "type": "String", "nullable": false },
      "status": { "column": "status", "type": "String", "nullable": false },
      "attempts": { "column": "attempts", "type": "Int", "nullable": false },
      "availableAt": { "column": "available_at", "type": "DateTime", "nullable": false },
      "lockedAt": { "column": "locked_at", "type": "DateTime", "nullable": true },
      "lockedBy": { "column": "locked_by", "type": "String", "nullable": true },
      "lastError": { "column": "last_error", "type": "String", "nullable": true },
      "createdAt": { "column": "created_at", "type": "DateTime", "nullable": false },
      "updatedAt": { "column": "updated_at", "type": "DateTime", "nullable": false }
    },
    "relations": {}
  },
  "UserDingTalkDepartment": {
    "table": "user_dingtalk_departments",
    "fields": {
      "id": {
        "column": "id",
        "type": "String",
        "nullable": false
      },
      "userId": {
        "column": "user_id",
        "type": "String",
        "nullable": false
      },
      "departmentId": {
        "column": "department_id",
        "type": "String",
        "nullable": false
      },
      "isPrimary": {
        "column": "is_primary",
        "type": "Boolean",
        "nullable": false
      },
      "syncAt": {
        "column": "sync_at",
        "type": "DateTime",
        "nullable": false
      }
    },
    "relations": {
      "user": {
        "model": "User",
        "list": false,
        "nullable": false,
        "relationName": "UserToDingTalkDepartment",
        "localFields": [
          "userId"
        ],
        "referenceFields": [
          "id"
        ]
      },
      "department": {
        "model": "DingTalkDepartment",
        "list": false,
        "nullable": false,
        "relationName": "DingTalkDepartmentToUser",
        "localFields": [
          "departmentId"
        ],
        "referenceFields": [
          "id"
        ]
      }
    }
  }
} as const;

export type ModelName = keyof typeof modelMetadata;
