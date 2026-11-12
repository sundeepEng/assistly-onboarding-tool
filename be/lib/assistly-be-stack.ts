import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { DynamoTableNames } from '../utils/constants';

export class LumaBeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    let stage: string = process.env.STAGE || 'dev';
    const domainName: string = 'assistly.live';

    //#region Cognito User Pool

    //lambda trigger to auto confirm the user
    const autoConfirmLambda = new lambda.Function(this, 'AutoConfirmUserLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
            event.response.autoConfirmUser = true;
            event.response.autoVerifyEmail = true;
            return event;
        };
      `),
    });

    const userPool = new cognito.UserPool(this, `UserPool-${stage}`, {
      userPoolName: `LumaUserPool-${stage}`,
      selfSignUpEnabled: true, // Allow users to sign up themselves
      signInAliases: { email: true }, // Allow email for login
      autoVerify: { email: false }, // Do not auto verify. We will handle this in preSignUp Lambda
      lambdaTriggers: {
        preSignUp: autoConfirmLambda,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
        fullName: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Destroy the user pool when the stack is destroyed
    });

    // Create App Client for User Pool
    const userPoolClient = new cognito.UserPoolClient(this, `LumaUserPoolClient-${stage}`, {
      userPool,
      generateSecret: false,
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.hours(6),
      refreshTokenValidity: cdk.Duration.days(30),
      idTokenValidity: cdk.Duration.hours(6),
    });
    console.info('User Pool Created', userPoolClient.userPoolClientId);
    //#endregion

    //#region RDS
    // Create a VPC with public and private subnets
    const vpc = new ec2.Vpc(this, 'LumaVpc', {
      vpcName: `LumaVpc-${stage}`,
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `PublicSubnet-${stage}`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `PrivateSubnet-${stage}`,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Create a security group for the RDS instance
    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'LumaRdsSG', {
      securityGroupName: `LumaRdsSecurityGroup-${stage}`,
      vpc,
      description: 'RDS security group',
      allowAllOutbound: true,
    });

    // Create a security group for the Lambda
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LumaLambdaSG', {
      securityGroupName: `LumaLambdaSecurityGroup-${stage}`,
      vpc,
      description: 'Lambda function security group',
      allowAllOutbound: true,
    });

    // Allow Lambda SG to connect to RDS SG on port 5432
    rdsSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Lambda access to Postgres'
    );

    // Create a security group for the HCM Lambda
    const hcmLambdaSecurityGroup = new ec2.SecurityGroup(this, 'HCMLambdaSG', {
      securityGroupName: `HCMLambdaSecurityGroup-${stage}`,
      vpc,
      description: 'HCM Lambda function security group',
      allowAllOutbound: true,
    });

    // Allow HCM Lambda SG to connect to RDS SG on port 5432
    rdsSecurityGroup.addIngressRule(
      hcmLambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'HCM Lambda access to Postgres'
    );

    // Create a security group for the TPI Lambda
    const tpiLambdaSecurityGroup = new ec2.SecurityGroup(this, 'TPILambdaSG', {
      securityGroupName: `TPILambdaSecurityGroup-${stage}`,
      vpc,
      description: 'TPI Lambda function security group',
      allowAllOutbound: true,
    });

    // Allow Lambda SG to connect to RDS SG on port 5432
    rdsSecurityGroup.addIngressRule(
      tpiLambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'TPI Lambda access to Postgres'
    );

    // Create a security group for the RevOps Lambda
    const revopsLambdaSecurityGroup = new ec2.SecurityGroup(this, 'RevOpsLambdaSG', {
      securityGroupName: `RevOpsLambdaSecurityGroup-${stage}`,
      vpc,
      description: 'RevOps Lambda function security group',
      allowAllOutbound: true,
    });

    // Allow Lambda SG to connect to RDS SG on port 5432
    rdsSecurityGroup.addIngressRule(
      revopsLambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'RevOps Lambda access to Postgres'
    );

    // Create a security group for the WS Lambda
    const wsLambdaSecurityGroup = new ec2.SecurityGroup(this, 'WSLambdaSG', {
      securityGroupName: `WSLambdaSecurityGroup-${stage}`,
      vpc,
      description: 'WS Lambda function security group',
      allowAllOutbound: true,
    });

    // Allow Lambda SG to connect to RDS SG on port 5432
    rdsSecurityGroup.addIngressRule(
      wsLambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'WS Lambda access to Postgres'
    );

    // Create a Secrets Manager secret for the DB credentials
    const postgresSecret = new secretsmanager.Secret(this, 'LumaPostgresSecret', {
      secretName: `PostgresCredentials-${stage}`,
      description: 'Postgres credentials for RDS instance',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    // Reference the externally created mobile notifications secret
    const mobileNotificationsSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      `MobileNotificationsSecret-${stage}`,
      `MobileNotifications-${stage}`
    );

    // Create RDS PostgreSQL instance
    const rdsInstance = new rds.DatabaseInstance(this, 'LumaPostgresRDS', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [rdsSecurityGroup],
      credentials: rds.Credentials.fromSecret(postgresSecret),
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      publiclyAccessible: false,
      databaseName: `assistlydb${stage}`,
    });

    //#endregion

    //#region SQS
    const eSignQueue = new sqs.Queue(this, `${stage}-eSignQueue`, {
      queueName: `eSignQueue-${stage}`,
      visibilityTimeout: cdk.Duration.seconds(120),
    });

    const notificationsDLQ = new sqs.Queue(this, `${stage}-NotificationsDLQ`, {
      queueName: `NotificationsDLQ-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    const notificationsQueue = new sqs.Queue(this, `${stage}-NotificationsQueue`, {
      queueName: `NotificationsQueue-${stage}`,
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: notificationsDLQ,
        maxReceiveCount: 5,
      },
    });

    const notificationEventsDlq = new sqs.Queue(this, `${stage}-NotificationEventsDLQ`, {
      queueName: `NotificationEventsDLQ-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    const notificationEventsQueue = new sqs.Queue(this, `${stage}-NotificationEvents`, {
      queueName: `NotificationEvents-${stage}`,
      visibilityTimeout: cdk.Duration.seconds(180),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: notificationEventsDlq,
        maxReceiveCount: 3,
      },
    });

    const notificationEventsWebQueue = new sqs.Queue(this, `${stage}-NotificationEventsWeb`, {
      queueName: `NotificationEventsWeb-${stage}`,
      visibilityTimeout: cdk.Duration.seconds(900),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: notificationEventsDlq,
        maxReceiveCount: 3,
      },
    });

    const notificationEventsCronQueue = new sqs.Queue(this, `${stage}-NotificationEventsCron`, {
      queueName: `NotificationEventsCron-${stage}`,
      visibilityTimeout: cdk.Duration.seconds(900),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: notificationEventsDlq,
        maxReceiveCount: 3,
      },
    });
    //#endregion

    //#region Lambda
    // Create a Lambda Layer for shared Node.js dependencies
    const lambdaLayer = new lambda.LayerVersion(this, 'NodeModulesLayer', {
      code: lambda.Code.fromAsset('layers'), // Path to the `node_modules` folder
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Layer for shared Node.js dependencies',
    });

    // Define the Lambda function for PCH
    const lambdaFunctionForPCH = new lambda.Function(this, `Luma-Handler-${stage}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/assistly.handler',
      code: lambda.Code.fromAsset('dist', {
        exclude: [
          'cdk.out',
          '.github',
          '.gitignore',
          '.npmignore',
          'README.md',
          'test',
          './bin',
          'node_modules',
        ],
      }),
      layers: [lambdaLayer],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(60),
      environment: {
        DB_SECRET_ARN: postgresSecret.secretArn,
        DB_NAME: `assistlydb${stage}`,
        DB_HOST: rdsInstance.dbInstanceEndpointAddress,
      },
    });

    // Grant Lambda access to the secret
    postgresSecret.grantRead(lambdaFunctionForPCH);

    // Grant TPI lambda to access all secrets from secrets manager
    lambdaFunctionForPCH.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'],
      })
    );

    // Add policy for lambda to access cognito actions
    lambdaFunctionForPCH.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminInitiateAuth',
        ],
        resources: ['*'], // Use specific ARNs if possible
      })
    );

    // Define the Lambda function for PCH
    const lambdaFunctionForHCM = new lambda.Function(this, `HCM-Handler-${stage}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/hcm.handler',
      code: lambda.Code.fromAsset('dist', {
        exclude: [
          'cdk.out',
          '.github',
          '.gitignore',
          '.npmignore',
          'README.md',
          'test',
          './bin',
          'node_modules',
        ],
      }),
      layers: [lambdaLayer],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [hcmLambdaSecurityGroup],
      timeout: cdk.Duration.seconds(60),
      environment: {
        DB_SECRET_ARN: postgresSecret.secretArn,
        DB_NAME: `assistlydb${stage}`,
        DB_HOST: rdsInstance.dbInstanceEndpointAddress,
      },
    });

    // Grant HCM Lambda access to the secret
    postgresSecret.grantRead(lambdaFunctionForHCM);

    // Add policy for HCM lambda to access cognito AdminGetUser and AdminUpdateUserAttributes
    lambdaFunctionForHCM.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:AdminGetUser', 'cognito-idp:AdminUpdateUserAttributes'],
        resources: ['*'], // Use specific ARNs if possible
      })
    );

    // Grant HCM lambda to access all secrets from secrets manager
    lambdaFunctionForHCM.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'],
      })
    );

    // Define the Lambda function for 3rd Party Integrations (TPI)
    const lambdaFunctionForTPI = new lambda.Function(this, `TPI-Handler-${stage}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/thirdPartyIntegrations.handler',
      code: lambda.Code.fromAsset('dist', {
        exclude: [
          'cdk.out',
          '.github',
          '.gitignore',
          '.npmignore',
          'README.md',
          'test',
          './bin',
          'node_modules',
        ],
      }),
      layers: [lambdaLayer],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [tpiLambdaSecurityGroup],
      timeout: cdk.Duration.seconds(60),
      environment: {
        DB_SECRET_ARN: postgresSecret.secretArn,
        DB_NAME: `assistlydb${stage}`,
        DB_HOST: rdsInstance.dbInstanceEndpointAddress,
      },
    });

    // Grant TPI lambda to access all secrets from secrets manager
    lambdaFunctionForTPI.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'],
      })
    );

    // Add policy for TPI lambda to access cognito AdminGetUser and AdminUpdateUserAttributes
    lambdaFunctionForTPI.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:AdminGetUser', 'cognito-idp:AdminUpdateUserAttributes'],
        resources: ['*'], // Use specific ARNs if possible
      })
    );

    // Define the Lambda function for RevOps
    const lambdaFunctionForRevOps = new lambda.Function(this, `RevOps-Handler-${stage}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/revops.handler',
      code: lambda.Code.fromAsset('dist', {
        exclude: [
          'cdk.out',
          '.github',
          '.gitignore',
          '.npmignore',
          'README.md',
          'test',
          './bin',
          'node_modules',
        ],
      }),
      layers: [lambdaLayer],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [revopsLambdaSecurityGroup],
      timeout: cdk.Duration.seconds(60),
      environment: {
        DB_SECRET_ARN: postgresSecret.secretArn,
        DB_NAME: `assistlydb${stage}`,
        DB_HOST: rdsInstance.dbInstanceEndpointAddress,
      },
    });

    // Grant TPI lambda to access all secrets from secrets manager
    lambdaFunctionForRevOps.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'],
      })
    );

    // Add policy for TPI lambda to access cognito AdminGetUser and AdminUpdateUserAttributes
    lambdaFunctionForRevOps.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:AdminGetUser', 'cognito-idp:AdminUpdateUserAttributes'],
        resources: ['*'], // Use specific ARNs if possible
      })
    );

    // Lambda function to process the ESign SQS Events
    const eSignProcessorLambda = new lambda.Function(this, `ESign-Processor-Lambda-${stage}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/eSignProcessor.handler',
      code: lambda.Code.fromAsset('dist', {
        exclude: [
          'cdk.out',
          '.github',
          '.gitignore',
          '.npmignore',
          'README.md',
          'test',
          './bin',
          'node_modules',
        ],
      }),
      timeout: cdk.Duration.seconds(120),
      layers: [lambdaLayer],
    });

    eSignProcessorLambda.addEventSource(
      new eventSources.SqsEventSource(eSignQueue, { batchSize: 1 })
    );

    // Notifications queue bindings
    lambdaFunctionForTPI.addEventSource(
      new eventSources.SqsEventSource(notificationsQueue, {
        batchSize: 5,
      })
    );

    // IAM Permissions for lambda to access SQS
    eSignQueue.grantSendMessages(lambdaFunctionForTPI);
    eSignQueue.grantConsumeMessages(eSignProcessorLambda);
    notificationsQueue.grantSendMessages(lambdaFunctionForTPI);
    notificationsQueue.grantConsumeMessages(lambdaFunctionForTPI);

    // Grant permissions for esign lambda to access secrets manager
    eSignProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'],
      })
    );

    // Lambda function for Websockets
    const wsLambda = new lambda.Function(this, `WS-Lambda-${stage}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/websockets.handler',
      code: lambda.Code.fromAsset('dist', {
        exclude: [
          'cdk.out',
          '.github',
          '.gitignore',
          '.npmignore',
          'README.md',
          'test',
          './bin',
          'node_modules',
        ],
      }),
      layers: [lambdaLayer],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [wsLambdaSecurityGroup],
      timeout: cdk.Duration.seconds(60),
      environment: {
        DB_SECRET_ARN: postgresSecret.secretArn,
        DB_NAME: `assistlydb${stage}`,
        DB_HOST: rdsInstance.dbInstanceEndpointAddress,
      },
    });

    // Grant permissions for WS lambda to access secrets manager
    wsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'],
      })
    );

    //#endregion

    //#region API Gateway

    // CloudWatch Log Group for API Gateway
    const logGroup = new logs.LogGroup(this, `ApiGatewayLogs-${stage}`, {
      logGroupName: `/aws/lumaapigateway/${stage}`, // Customize log group name
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Destroy logs when the stack is destroyed
    });

    // Define the API Gateway
    const api = new apigateway.RestApi(this, `luma-api-${stage}`, {
      restApiName: `LumaEndPoints-${stage}`,
      description: 'API service for Luma',
      deployOptions: {
        stageName: stage,
        loggingLevel: apigateway.MethodLoggingLevel.INFO, // Log level (INFO/ERROR)
        dataTraceEnabled: true, // Log request/response data
        metricsEnabled: true, // Enable CloudWatch metrics
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
    });

    // Add Cognito User Pool Authorizer to API Gateway
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      `CognitoAuthorizer-${stage}`,
      {
        cognitoUserPools: [userPool], // Reference the Cognito User Pool
        identitySource: 'method.request.header.Authorization', // Look for token in the Authorization header
      }
    );

    const apiGatewayInvokeRole = new iam.Role(this, `ApiGatewayInvokeRole-${stage}`, {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    lambdaFunctionForPCH.grantInvoke(apiGatewayInvokeRole);
    lambdaFunctionForHCM.grantInvoke(apiGatewayInvokeRole);
    lambdaFunctionForTPI.grantInvoke(apiGatewayInvokeRole);
    lambdaFunctionForRevOps.grantInvoke(apiGatewayInvokeRole);

    const pchIntegration = new apigateway.LambdaIntegration(lambdaFunctionForPCH, {
      credentialsRole: apiGatewayInvokeRole,
      allowTestInvoke: false,
    });

    const hcmIntegration = new apigateway.LambdaIntegration(lambdaFunctionForHCM, {
      credentialsRole: apiGatewayInvokeRole,
      allowTestInvoke: false,
    });

    const tpiIntegration = new apigateway.LambdaIntegration(lambdaFunctionForTPI, {
      credentialsRole: apiGatewayInvokeRole,
      allowTestInvoke: false,
    });

    const revOpsIntegration = new apigateway.LambdaIntegration(lambdaFunctionForRevOps, {
      credentialsRole: apiGatewayInvokeRole,
      allowTestInvoke: false,
    });

    // WebSocket API
    const wsApi = new apigatewayv2.WebSocketApi(this, `ChatWebSocketApi-${stage}`, {
      connectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('ConnectIntegration', wsLambda),
      },
      disconnectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('DisconnectIntegration', wsLambda),
      },
      defaultRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('DefaultIntegration', wsLambda),
      },
    });

    const wsStage = new apigatewayv2.WebSocketStage(this, `WSStage-${stage}`, {
      webSocketApi: wsApi,
      stageName: stage,
      autoDeploy: true,
    });

    wsApi.addRoute('sendMessage', {
      integration: new integrations.WebSocketLambdaIntegration('SendMsgIntegration', wsLambda),
    });

    // Grant the Lambdas permission to call postToConnection
    const postToConnectionPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${wsApi.apiId}/${stage}/*`,
      ],
    });
    wsLambda.addToRolePolicy(postToConnectionPolicy);
    //#endregion

    //#region DynamoDB tables
    //#region Home table
    var homeTable: dynamodb.ITable;
    const homeTableName: string = DynamoTableNames.homeTableName;
    try {
      homeTable = new dynamodb.Table(this, homeTableName, {
        tableName: `${homeTableName}-${stage}`,
        partitionKey: {
          name: 'homeId',
          type: dynamodb.AttributeType.STRING,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      });
    } catch (error) {
      console.log(`Table ${homeTableName}-${stage} exists`);
      homeTable = dynamodb.Table.fromTableName(
        this,
        `ExistingHomeTable`,
        `${homeTableName}-${stage}`
      );
    }

    // Add GSI for home name
    try {
      (homeTable as dynamodb.Table).addGlobalSecondaryIndex({
        indexName: `HomeNameIndex-${stage}`,
        partitionKey: { name: 'homeName', type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL, // Include all attributes in the index
      });
    } catch (error) {
      console.error('Error creating HomeNameIndex:', error);
      throw error;
    }
    //#endregion

    //#region users table
    //check if users table exists if not then create a dynamodb table with users
    var usersTable: dynamodb.ITable;
    const usersTableName: string = DynamoTableNames.usersTableName;
    try {
      usersTable = new dynamodb.Table(this, usersTableName, {
        tableName: `${usersTableName}-${stage}`,
        partitionKey: {
          name: 'userId',
          type: dynamodb.AttributeType.STRING,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      });

      // Add GSI for role and home
      (usersTable as dynamodb.Table).addGlobalSecondaryIndex({
        indexName: `RoleHomeIndex-${stage}`,
        partitionKey: { name: 'role', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'home', type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      });

      // Add GSI for email
      (usersTable as dynamodb.Table).addGlobalSecondaryIndex({
        indexName: `EmailIndex-${stage}`,
        partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL, // Include all attributes in the index
      });

      // Add GSI for role and homeId
      (usersTable as dynamodb.Table).addGlobalSecondaryIndex({
        indexName: `RoleHomeIdIndex-${stage}`,
        partitionKey: { name: 'role', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'homeId', type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      });
    } catch (error) {
      console.log(`Table ${usersTableName}-${stage} exists`);
      usersTable = dynamodb.Table.fromTableName(
        this,
        `ExistingUsersTable`,
        `${usersTableName}-${stage}`
      );
    }
    //#endregion

    //#region Clinical table
    //check if clinical table exists if not then create a dynamodb table with clinical data
    var clinicalTable: dynamodb.ITable;
    const clinicalTableName: string = DynamoTableNames.clinicalTableName;
    try {
      clinicalTable = new dynamodb.Table(this, clinicalTableName, {
        tableName: `${clinicalTableName}-${stage}`,
        partitionKey: {
          name: 'userId',
          type: dynamodb.AttributeType.STRING,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      });
    } catch (error) {
      console.log(`Table ${clinicalTableName}-${stage} exists`);
      clinicalTable = dynamodb.Table.fromTableName(
        this,
        `ExistingClinicalTable`,
        `${clinicalTableName}-${stage}`
      );
    }
    //#endregion

    //#region Role based assets table
    //Role based assets table
    var roleAssetsMappingTable: dynamodb.ITable;
    const roleAssetsMappingTableName: string = DynamoTableNames.roleAssetsMappingTableName;
    try {
      roleAssetsMappingTable = new dynamodb.Table(this, roleAssetsMappingTableName, {
        tableName: `${roleAssetsMappingTableName}-${stage}`,
        partitionKey: {
          name: 'role',
          type: dynamodb.AttributeType.STRING,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      });
    } catch (error) {
      console.log(`Table ${roleAssetsMappingTableName}-${stage} exists`);
      roleAssetsMappingTable = dynamodb.Table.fromTableName(
        this,
        `ExistingRoleAssetsMappingTable`,
        `${roleAssetsMappingTableName}-${stage}`
      );
    }
    //#endregion

    //#region SQS jobs table
    var sqsJobsTable: dynamodb.ITable;
    const sqsJobsTableName: string = DynamoTableNames.sqsJobsTableName;
    try {
      sqsJobsTable = new dynamodb.Table(this, sqsJobsTableName, {
        tableName: `${sqsJobsTableName}-${stage}`,
        partitionKey: {
          name: 'jobId',
          type: dynamodb.AttributeType.STRING,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      });
    } catch (error) {
      console.log(`Table ${sqsJobsTableName}-${stage} exists`);
      sqsJobsTable = dynamodb.Table.fromTableName(
        this,
        `ExistingSqsJobsTable`,
        `${sqsJobsTableName}-${stage}`
      );
    }

    //#region Websockets connections table
    var wsConnectionsTable: dynamodb.ITable;
    const wsConnectionsTableName: string = DynamoTableNames.wsConnectionsTableName;
    try {
      wsConnectionsTable = new dynamodb.Table(this, wsConnectionsTableName, {
        tableName: `${wsConnectionsTableName}-${stage}`,
        partitionKey: {
          name: 'connectionId',
          type: dynamodb.AttributeType.STRING,
        },
        timeToLiveAttribute: 'ttl',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      });
    } catch (error) {
      console.log(`Table ${wsConnectionsTableName}-${stage} exists`);
      wsConnectionsTable = dynamodb.Table.fromTableName(
        this,
        `ExistingWsConnectionsTable`,
        `${wsConnectionsTableName}-${stage}`
      );
    }

    // GSI for querying connections by userId
    (wsConnectionsTable as dynamodb.Table).addGlobalSecondaryIndex({
      indexName: `WSUserIdIndex-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    //#endregion

    //#region Notification devices table
    let notificationDevicesTable: dynamodb.ITable;
    const notificationDevicesTableName: string = DynamoTableNames.notificationDevicesTableName;
    try {
      notificationDevicesTable = new dynamodb.Table(this, notificationDevicesTableName, {
        tableName: `${notificationDevicesTableName}-${stage}`,
        partitionKey: {
          name: 'userId',
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: 'deviceId',
          type: dynamodb.AttributeType.STRING,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      });

      (notificationDevicesTable as dynamodb.Table).addGlobalSecondaryIndex({
        indexName: `NotificationDeviceTokenIndex-${stage}`,
        partitionKey: {
          name: 'deviceToken',
          type: dynamodb.AttributeType.STRING,
        },
        projectionType: dynamodb.ProjectionType.ALL,
      });
    } catch (error) {
      console.log(`Table ${notificationDevicesTableName}-${stage} exists`);
      notificationDevicesTable = dynamodb.Table.fromTableName(
        this,
        `ExistingNotificationDevicesTable`,
        `${notificationDevicesTableName}-${stage}`
      );
    }
    //#endregion

    //#endregion

    //#region Document expiry notifier lambda
    const cronJobsLambda = new lambda.Function(this, `cronJobsLambda-${stage}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/cronJobs.handler',
      code: lambda.Code.fromAsset('dist', {
        exclude: [
          'cdk.out',
          '.github',
          '.gitignore',
          '.npmignore',
          'README.md',
          'test',
          './bin',
          'node_modules',
        ],
      }),
      timeout: cdk.Duration.minutes(5),
      layers: [lambdaLayer],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [tpiLambdaSecurityGroup],
      environment: {
        STAGE: stage,
        USERS_TABLE_NAME: usersTable.tableName,
        HOME_TABLE_NAME: homeTable.tableName,
        NOTIFICATIONS_QUEUE_URL: notificationEventsQueue.queueUrl,
        DB_SECRET_ARN: postgresSecret.secretArn,
        DB_NAME: `assistlydb${stage}`,
        DB_HOST: rdsInstance.dbInstanceEndpointAddress,
        CURRENT_AWS_REGION: process.env.CDK_DEFAULT_REGION!,
        CRYPTO_ENCRYPTION_KEY: process.env.CRYPTO_ENCRYPTION_KEY!,
      },
    });

    postgresSecret.grantRead(cronJobsLambda);
    notificationEventsQueue.grantSendMessages(cronJobsLambda);

    const documentExpiryRule = new events.Rule(this, `DocumentExpirySchedule-${stage}`, {
      schedule: events.Schedule.cron({
        hour: '19',
        minute: '50',
        day: '*',
        month: '*',
        year: '*',
      }),
    });

    documentExpiryRule.addTarget(new targets.LambdaFunction(cronJobsLambda));
    //#endregion

    //#region Notification event workers
    const notificationDispatcherLambda = new lambda.Function(
      this,
      `NotificationsDispatcher-${stage}`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'functions/notifications-dispatcher.handler',
        code: lambda.Code.fromAsset('dist', {
          exclude: [
            'cdk.out',
            '.github',
            '.gitignore',
            '.npmignore',
            'README.md',
            'test',
            './bin',
            'node_modules',
          ],
        }),
        timeout: cdk.Duration.seconds(60),
        layers: [lambdaLayer],
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [tpiLambdaSecurityGroup],
        environment: {
          DB_SECRET_ARN: postgresSecret.secretArn,
          DB_NAME: `assistlydb${stage}`,
          DB_HOST: rdsInstance.dbInstanceEndpointAddress,
          NOTIFICATIONS_WEB_QUEUE_URL: notificationEventsWebQueue.queueUrl,
          NOTIFICATIONS_CRON_QUEUE_URL: notificationEventsCronQueue.queueUrl,
          STAGE: stage,
          CURRENT_AWS_REGION: process.env.CDK_DEFAULT_REGION!,
        },
      }
    );

    const notificationWebWorkerLambda = new lambda.Function(this, `NotificationsWeb-${stage}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/notifications-web.handler',
      code: lambda.Code.fromAsset('dist', {
        exclude: [
          'cdk.out',
          '.github',
          '.gitignore',
          '.npmignore',
          'README.md',
          'test',
          './bin',
          'node_modules',
        ],
      }),
      timeout: cdk.Duration.minutes(5),
      layers: [lambdaLayer],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [tpiLambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: postgresSecret.secretArn,
        DB_NAME: `assistlydb${stage}`,
        DB_HOST: rdsInstance.dbInstanceEndpointAddress,
        STAGE: stage,
        CURRENT_AWS_REGION: process.env.CDK_DEFAULT_REGION!,
      },
    });

    const notificationCronWorkerLambda = new lambda.Function(this, `NotificationsCron-${stage}`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/notifications-cron.handler',
      code: lambda.Code.fromAsset('dist', {
        exclude: [
          'cdk.out',
          '.github',
          '.gitignore',
          '.npmignore',
          'README.md',
          'test',
          './bin',
          'node_modules',
        ],
      }),
      timeout: cdk.Duration.minutes(5),
      layers: [lambdaLayer],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [tpiLambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: postgresSecret.secretArn,
        DB_NAME: `assistlydb${stage}`,
        DB_HOST: rdsInstance.dbInstanceEndpointAddress,
        STAGE: stage,
        CURRENT_AWS_REGION: process.env.CDK_DEFAULT_REGION!,
      },
    });

    const notificationReconcileLambda = new lambda.Function(
      this,
      `NotificationsReconcile-${stage}`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'functions/notifications-reconcile.handler',
        code: lambda.Code.fromAsset('dist', {
          exclude: [
            'cdk.out',
            '.github',
            '.gitignore',
            '.npmignore',
            'README.md',
            'test',
            './bin',
            'node_modules',
          ],
        }),
        timeout: cdk.Duration.minutes(5),
        layers: [lambdaLayer],
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [tpiLambdaSecurityGroup],
        environment: {
          DB_SECRET_ARN: postgresSecret.secretArn,
          DB_NAME: `assistlydb${stage}`,
          DB_HOST: rdsInstance.dbInstanceEndpointAddress,
          NOTIFICATIONS_QUEUE_URL: notificationEventsQueue.queueUrl,
          STAGE: stage,
          CURRENT_AWS_REGION: process.env.CDK_DEFAULT_REGION!,
        },
      }
    );

    const notificationDevicesCleanupLambda = new lambda.Function(
      this,
      `NotificationsDevicesCleanup-${stage}`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'functions/notifications-devices-cleanup.handler',
        code: lambda.Code.fromAsset('dist', {
          exclude: [
            'cdk.out',
            '.github',
            '.gitignore',
            '.npmignore',
            'README.md',
            'test',
            './bin',
            'node_modules',
          ],
        }),
        timeout: cdk.Duration.minutes(5),
        layers: [lambdaLayer],
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [tpiLambdaSecurityGroup],
        environment: {
          DB_SECRET_ARN: postgresSecret.secretArn,
          DB_NAME: `assistlydb${stage}`,
          DB_HOST: rdsInstance.dbInstanceEndpointAddress,
          STAGE: stage,
          CURRENT_AWS_REGION: process.env.CDK_DEFAULT_REGION!,
        },
      }
    );

    notificationDispatcherLambda.addEventSource(
      new eventSources.SqsEventSource(notificationEventsQueue, {
        batchSize: 10,
      })
    );
    notificationWebWorkerLambda.addEventSource(
      new eventSources.SqsEventSource(notificationEventsWebQueue, {
        batchSize: 10,
      })
    );
    notificationCronWorkerLambda.addEventSource(
      new eventSources.SqsEventSource(notificationEventsCronQueue, {
        batchSize: 10,
      })
    );

    notificationEventsQueue.grantConsumeMessages(notificationDispatcherLambda);
    notificationEventsWebQueue.grantSendMessages(notificationDispatcherLambda);
    notificationEventsCronQueue.grantSendMessages(notificationDispatcherLambda);
    notificationEventsQueue.grantSendMessages(notificationReconcileLambda);

    postgresSecret.grantRead(notificationDispatcherLambda);
    postgresSecret.grantRead(notificationWebWorkerLambda);
    postgresSecret.grantRead(notificationCronWorkerLambda);
    postgresSecret.grantRead(notificationReconcileLambda);
    postgresSecret.grantRead(notificationDevicesCleanupLambda);

    mobileNotificationsSecret.grantRead(notificationDispatcherLambda);
    mobileNotificationsSecret.grantRead(notificationWebWorkerLambda);
    mobileNotificationsSecret.grantRead(notificationCronWorkerLambda);
    mobileNotificationsSecret.grantRead(notificationReconcileLambda);
    mobileNotificationsSecret.grantRead(notificationDevicesCleanupLambda);

    const reconcileRule = new events.Rule(this, `NotificationsReconcileSchedule-${stage}`, {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });
    reconcileRule.addTarget(new targets.LambdaFunction(notificationReconcileLambda));

    const devicesCleanupRule = new events.Rule(
      this,
      `NotificationsDevicesCleanupSchedule-${stage}`,
      {
        schedule: events.Schedule.cron({
          hour: '5',
          minute: '0',
          day: '*',
          month: '*',
          year: '*',
        }),
      }
    );
    devicesCleanupRule.addTarget(new targets.LambdaFunction(notificationDevicesCleanupLambda));
    //#endregion

    //Grant DynamoDb permission for PCH lambda function
    lambdaFunctionForPCH.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:Scan',
          'dynamodb:Query',
          'dynamodb:BatchGetItem',
          'dynamodb:DeleteItem',
        ],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/RoleHomeIndex-${stage}`,
          `${usersTable.tableArn}/index/RoleHomeIdIndex-${stage}`,
          `${usersTable.tableArn}/index/EmailIndex-${stage}`,
          roleAssetsMappingTable.tableArn,
          clinicalTable.tableArn,
          homeTable.tableArn,
          `${homeTable.tableArn}/index/HomeNameIndex-${stage}`,
        ],
      })
    );

    //Grant DynamoDb permission for HCM lambda function
    lambdaFunctionForHCM.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:Scan',
          'dynamodb:Query',
          'dynamodb:BatchGetItem',
        ],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/RoleHomeIndex-${stage}`,
          `${usersTable.tableArn}/index/RoleHomeIdIndex-${stage}`,
          `${usersTable.tableArn}/index/EmailIndex-${stage}`,
          roleAssetsMappingTable.tableArn,
          clinicalTable.tableArn,
          homeTable.tableArn,
          `${homeTable.tableArn}/index/HomeNameIndex-${stage}`,
        ],
      })
    );

    //Grant DynamoDb permission for TPI lambda function
    lambdaFunctionForTPI.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:Scan',
          'dynamodb:Query',
          'dynamodb:BatchGetItem',
          'dynamodb:DeleteItem',
        ],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/RoleHomeIndex-${stage}`,
          `${usersTable.tableArn}/index/RoleHomeIdIndex-${stage}`,
          `${usersTable.tableArn}/index/EmailIndex-${stage}`,
          roleAssetsMappingTable.tableArn,
          clinicalTable.tableArn,
          homeTable.tableArn,
          `${homeTable.tableArn}/index/HomeNameIndex-${stage}`,
          sqsJobsTable.tableArn,
          notificationDevicesTable.tableArn,
          `${notificationDevicesTable.tableArn}/index/NotificationDeviceTokenIndex-${stage}`,
        ],
      })
    );

    //Grant DynamoDb permission for Revops lambda function
    lambdaFunctionForRevOps.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:Scan',
          'dynamodb:Query',
          'dynamodb:BatchGetItem',
          'dynamodb:DeleteItem',
        ],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/RoleHomeIndex-${stage}`,
          `${usersTable.tableArn}/index/RoleHomeIdIndex-${stage}`,
          `${usersTable.tableArn}/index/EmailIndex-${stage}`,
          roleAssetsMappingTable.tableArn,
          clinicalTable.tableArn,
          homeTable.tableArn,
          `${homeTable.tableArn}/index/HomeNameIndex-${stage}`,
        ],
      })
    );

    //Grant DynamoDb permission for ESign Processor lambda function
    eSignProcessorLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:BatchGetItem'],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/RoleHomeIndex-${stage}`,
          `${usersTable.tableArn}/index/RoleHomeIdIndex-${stage}`,
          `${usersTable.tableArn}/index/EmailIndex-${stage}`,
          sqsJobsTable.tableArn,
        ],
      })
    );

    wsLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:BatchGetItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
        ],
        resources: [
          usersTable.tableArn,
          homeTable.tableArn,
          `${homeTable.tableArn}/index/HomeNameIndex-${stage}`,
          wsConnectionsTable.tableArn,
          `${wsConnectionsTable.tableArn}/index/WSUserIdIndex-${stage}`,
        ],
      })
    );

    //Grant DynamoDb permission for Cronjobs lambda function
    cronJobsLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:Scan', 'dynamodb:Query', 'dynamodb:BatchGetItem'],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/RoleHomeIndex-${stage}`,
          `${usersTable.tableArn}/index/RoleHomeIdIndex-${stage}`,
          `${usersTable.tableArn}/index/EmailIndex-${stage}`,
          homeTable.tableArn,
          `${homeTable.tableArn}/index/HomeNameIndex-${stage}`,
        ],
      })
    );

    //#endregion

    //#region Lambda Environment Variables
    //#region PCH lambda environment variables
    lambdaFunctionForPCH.addEnvironment('USER_POOL_ID', userPool.userPoolId);
    lambdaFunctionForPCH.addEnvironment('USER_POOL_CLIENT_ID', userPoolClient.userPoolClientId);
    lambdaFunctionForPCH.addEnvironment('STAGE', stage);
    lambdaFunctionForPCH.addEnvironment('CURRENT_AWS_REGION', process.env.CDK_DEFAULT_REGION!);
    lambdaFunctionForPCH.addEnvironment('USERS_TABLE_NAME', usersTable.tableName);
    lambdaFunctionForPCH.addEnvironment('CLINICAL_TABLE_NAME', clinicalTable.tableName);
    lambdaFunctionForPCH.addEnvironment(
      'CRYPTO_ENCRYPTION_KEY',
      process.env.CRYPTO_ENCRYPTION_KEY!
    );
    lambdaFunctionForPCH.addEnvironment(
      'ROLE_ASSETS_MAPPING_TABLE_NAME',
      roleAssetsMappingTable.tableName
    );
    lambdaFunctionForPCH.addEnvironment('HOME_TABLE_NAME', homeTable.tableName);
    //#endregion

    //#region HCM lambda environment variables
    lambdaFunctionForHCM.addEnvironment('USER_POOL_ID', userPool.userPoolId);
    lambdaFunctionForHCM.addEnvironment('USER_POOL_CLIENT_ID', userPoolClient.userPoolClientId);
    lambdaFunctionForHCM.addEnvironment('STAGE', stage);
    lambdaFunctionForHCM.addEnvironment('CURRENT_AWS_REGION', process.env.CDK_DEFAULT_REGION!);
    lambdaFunctionForHCM.addEnvironment('USERS_TABLE_NAME', usersTable.tableName);
    lambdaFunctionForHCM.addEnvironment('CLINICAL_TABLE_NAME', clinicalTable.tableName);
    lambdaFunctionForHCM.addEnvironment(
      'CRYPTO_ENCRYPTION_KEY',
      process.env.CRYPTO_ENCRYPTION_KEY!
    );
    lambdaFunctionForHCM.addEnvironment(
      'ROLE_ASSETS_MAPPING_TABLE_NAME',
      roleAssetsMappingTable.tableName
    );
    lambdaFunctionForHCM.addEnvironment('HOME_TABLE_NAME', homeTable.tableName);
    lambdaFunctionForHCM.addEnvironment(
      'NOTIFICATIONS_QUEUE_URL',
      notificationEventsQueue.queueUrl
    );
    notificationEventsQueue.grantSendMessages(lambdaFunctionForHCM);
    //#endregion

    //#region TPI lambda environment variables
    lambdaFunctionForTPI.addEnvironment('USER_POOL_ID', userPool.userPoolId);
    lambdaFunctionForTPI.addEnvironment('USER_POOL_CLIENT_ID', userPoolClient.userPoolClientId);
    lambdaFunctionForTPI.addEnvironment('STAGE', stage);
    lambdaFunctionForTPI.addEnvironment('CURRENT_AWS_REGION', process.env.CDK_DEFAULT_REGION!);
    lambdaFunctionForTPI.addEnvironment('USERS_TABLE_NAME', usersTable.tableName);
    lambdaFunctionForTPI.addEnvironment('CLINICAL_TABLE_NAME', clinicalTable.tableName);
    lambdaFunctionForTPI.addEnvironment(
      'CRYPTO_ENCRYPTION_KEY',
      process.env.CRYPTO_ENCRYPTION_KEY!
    );
    lambdaFunctionForTPI.addEnvironment(
      'ROLE_ASSETS_MAPPING_TABLE_NAME',
      roleAssetsMappingTable.tableName
    );
    lambdaFunctionForTPI.addEnvironment('HOME_TABLE_NAME', homeTable.tableName);
    lambdaFunctionForTPI.addEnvironment('SQS_JOBS_TABLE_NAME', sqsJobsTable.tableName);
    lambdaFunctionForTPI.addEnvironment('ESIGN_QUEUE_URL', eSignQueue.queueUrl);
    lambdaFunctionForTPI.addEnvironment(
      'NOTIFICATIONS_QUEUE_URL',
      notificationEventsQueue.queueUrl
    );
    lambdaFunctionForTPI.addEnvironment(
      'NOTIFICATION_DEVICES_TABLE_NAME',
      notificationDevicesTable.tableName
    );
    notificationEventsQueue.grantSendMessages(lambdaFunctionForTPI);
    //#endregion

    //#region Revops lambda environment variables
    lambdaFunctionForRevOps.addEnvironment('USER_POOL_ID', userPool.userPoolId);
    lambdaFunctionForRevOps.addEnvironment('USER_POOL_CLIENT_ID', userPoolClient.userPoolClientId);
    lambdaFunctionForRevOps.addEnvironment('STAGE', stage);
    lambdaFunctionForRevOps.addEnvironment('CURRENT_AWS_REGION', process.env.CDK_DEFAULT_REGION!);
    lambdaFunctionForRevOps.addEnvironment('USERS_TABLE_NAME', usersTable.tableName);
    lambdaFunctionForRevOps.addEnvironment('CLINICAL_TABLE_NAME', clinicalTable.tableName);
    lambdaFunctionForRevOps.addEnvironment(
      'CRYPTO_ENCRYPTION_KEY',
      process.env.CRYPTO_ENCRYPTION_KEY!
    );
    lambdaFunctionForRevOps.addEnvironment(
      'ROLE_ASSETS_MAPPING_TABLE_NAME',
      roleAssetsMappingTable.tableName
    );
    lambdaFunctionForRevOps.addEnvironment('HOME_TABLE_NAME', homeTable.tableName);
    //#endregion

    //#region ESign Processor lambda environment variables
    eSignProcessorLambda.addEnvironment('USER_POOL_ID', userPool.userPoolId);
    eSignProcessorLambda.addEnvironment('USER_POOL_CLIENT_ID', userPoolClient.userPoolClientId);
    eSignProcessorLambda.addEnvironment('STAGE', stage);
    eSignProcessorLambda.addEnvironment('CURRENT_AWS_REGION', process.env.CDK_DEFAULT_REGION!);
    eSignProcessorLambda.addEnvironment('USERS_TABLE_NAME', usersTable.tableName);
    eSignProcessorLambda.addEnvironment(
      'CRYPTO_ENCRYPTION_KEY',
      process.env.CRYPTO_ENCRYPTION_KEY!
    );
    eSignProcessorLambda.addEnvironment('HOME_TABLE_NAME', homeTable.tableName);
    eSignProcessorLambda.addEnvironment('SQS_JOBS_TABLE_NAME', sqsJobsTable.tableName);
    eSignProcessorLambda.addEnvironment('ESIGN_QUEUE_URL', eSignQueue.queueUrl);
    //#endregion

    //#region WS Lambda environment variables
    wsLambda.addEnvironment('STAGE', stage);
    wsLambda.addEnvironment('USERS_TABLE_NAME', usersTable.tableName);
    wsLambda.addEnvironment('HOME_TABLE_NAME', homeTable.tableName);
    wsLambda.addEnvironment('CURRENT_AWS_REGION', process.env.CDK_DEFAULT_REGION!);
    wsLambda.addEnvironment('CRYPTO_ENCRYPTION_KEY', process.env.CRYPTO_ENCRYPTION_KEY!);
    wsLambda.addEnvironment('WS_CONNECTIONS_TABLE_NAME', wsConnectionsTable.tableName);
    wsLambda.addEnvironment('WS_API_ENDPOINT', wsStage.url);

    // //Video Transcription lambda trigger environment variables
    // videoTranscriptionLambdaTrigger.addEnvironment("STAGE", stage);
    // videoTranscriptionLambdaTrigger.addEnvironment(
    //   "CURRENT_AWS_REGION",
    //   process.env.CDK_DEFAULT_REGION!
    // );
    // videoTranscriptionLambdaTrigger.addEnvironment(
    //   "HOME_TABLE_NAME",
    //   homeTable.tableName
    // );
    // videoTranscriptionLambdaTrigger.addEnvironment(
    //   "CRYPTO_ENCRYPTION_KEY",
    //   process.env.CRYPTO_ENCRYPTION_KEY!
    // );
    //#endregion

    //#endregion

    //#region S3
    // Identity pool to provide access to s3
    const identityPool = new cognito.CfnIdentityPool(this, `IdentityPool-${stage}`, {
      identityPoolName: `LumaIdentityPool-${stage}`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // Create IAM role for authenticated users with S3 full access
    const authenticatedRole = new iam.Role(this, `AuthenticatedRole-${stage}`, {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated', // Condition: only authenticated users
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess')],
    });

    // Add inline policy to the authenticated role for GetCredentialsForIdentity
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-identity:GetCredentialsForIdentity'],
        resources: ['*'], // Allow access to all identity resources (typically Identity Pool)
      })
    );

    new cognito.CfnIdentityPoolRoleAttachment(this, `IdentityPoolRoleAttachment-${stage}`, {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    // Define CORS Configuration
    const corsConfiguration: s3.CorsRule = {
      allowedHeaders: ['*'], // Allow all headers
      allowedMethods: [
        s3.HttpMethods.GET,
        s3.HttpMethods.POST,
        s3.HttpMethods.PUT,
        s3.HttpMethods.DELETE,
      ],
      allowedOrigins: ['*'], // Allow all origins
      exposedHeaders: ['ETag'], // Expose ETag header
      maxAge: 3000, // Cache preflight response for 3000 seconds
    };

    // S3 bucket for storing profile images
    const profileImagesBucket = new s3.Bucket(this, `ProfileImagesBucket-${stage}`, {
      bucketName: `${stage}-${domainName}-user-profile-images`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [corsConfiguration],
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
    });

    // Define a bucket policy to allow access only to authenticated users from the Cognito User Pool
    const profileImagesBucketPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${profileImagesBucket.bucketArn}/*`],
      effect: iam.Effect.ALLOW,
      principals: [
        new iam.ArnPrincipal(
          `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/${authenticatedRole.roleName}`
        ),
      ],
    });

    // Attach the policy to the bucket
    profileImagesBucket.addToResourcePolicy(profileImagesBucketPolicy);

    // Bucket for storing original Onboarding documents for PCG, Senior
    const originalOnboardingContractsBucket = new s3.Bucket(
      this,
      `OriginalOnboardingContractsBucket-${stage}`,
      {
        bucketName: `${stage}-${domainName}-original-onboarding-contracts`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        cors: [corsConfiguration],
        publicReadAccess: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
      }
    );

    // Define a bucket policy to allow access only to authenticated users from the Cognito User Pool
    const originalOnboardingContractsBucketPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${originalOnboardingContractsBucket.bucketArn}/*`],
      effect: iam.Effect.ALLOW,
      principals: [
        new iam.ArnPrincipal(
          `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/${authenticatedRole.roleName}`
        ),
      ],
    });

    // Attach the policy to the bucket
    originalOnboardingContractsBucket.addToResourcePolicy(originalOnboardingContractsBucketPolicy);

    // Bucket for storing original Onboarding documents for PCG, Senior
    const modifiedOnboardingContractsBucket = new s3.Bucket(
      this,
      `ModifiedOnboardingContractsBucket-${stage}`,
      {
        bucketName: `${stage}-${domainName}-modified-onboarding-contracts`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        cors: [corsConfiguration],
      }
    );

    // Define a bucket policy to allow access only to authenticated users from the Cognito User Pool
    const modifiedOnboardingContractsBucketPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${modifiedOnboardingContractsBucket.bucketArn}/*`],
      effect: iam.Effect.ALLOW,
      principals: [
        new iam.ArnPrincipal(
          `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/${authenticatedRole.roleName}`
        ),
      ],
    });

    // Attach the policy to the bucket
    modifiedOnboardingContractsBucket.addToResourcePolicy(modifiedOnboardingContractsBucketPolicy);

    // Bucket for storing user documents with path - `homeId/userId/files
    const userDocumentsBucket = new s3.Bucket(this, `UserDocuments-${stage}`, {
      bucketName: `${stage}-${domainName}-user-documents`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [corsConfiguration],
    });

    // Define a bucket policy to allow access only to authenticated users from the Cognito User Pool
    const userDocumentsBucketPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${userDocumentsBucket.bucketArn}/*`],
      effect: iam.Effect.ALLOW,
      principals: [
        new iam.ArnPrincipal(
          `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/${authenticatedRole.roleName}`
        ),
      ],
    });

    // Attach the policy to the bucket
    userDocumentsBucket.addToResourcePolicy(userDocumentsBucketPolicy);

    lambdaFunctionForPCH.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:DeleteObject',
          's3:GetObject',
          's3:ListBucket', // this is often needed for presigned URLs or validating the object
        ],
        resources: [
          profileImagesBucket.bucketArn,
          `${profileImagesBucket.bucketArn}/*`,
          originalOnboardingContractsBucket.bucketArn,
          `${originalOnboardingContractsBucket.bucketArn}/*`,
          modifiedOnboardingContractsBucket.bucketArn,
          `${modifiedOnboardingContractsBucket.bucketArn}/*`,
          userDocumentsBucket.bucketArn,
          `${userDocumentsBucket.bucketArn}/*`,
        ],
      })
    );

    lambdaFunctionForPCH.addEnvironment(
      'USER_DOCUMENTS_BUCKET_NAME',
      userDocumentsBucket.bucketName
    );
    lambdaFunctionForPCH.addEnvironment(
      'ORIGINAL_CONTRACTS_BUCKET_NAME',
      originalOnboardingContractsBucket.bucketName
    );
    lambdaFunctionForPCH.addEnvironment(
      'MODIFIED_CONTRACTS_BUCKET_NAME',
      modifiedOnboardingContractsBucket.bucketName
    );
    lambdaFunctionForPCH.addEnvironment(
      'USER_PROFILE_IMAGES_BUCKET_NAME',
      profileImagesBucket.bucketName
    );

    // Add permissions to HCM Lambda function to access S3 buckets
    lambdaFunctionForHCM.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:ListBucket', // this is often needed for presigned URLs or validating the object
        ],
        resources: [
          originalOnboardingContractsBucket.bucketArn,
          `${originalOnboardingContractsBucket.bucketArn}/*`,
          userDocumentsBucket.bucketArn,
          `${userDocumentsBucket.bucketArn}/*`,
        ],
      })
    );

    lambdaFunctionForHCM.addEnvironment(
      'ORIGINAL_CONTRACTS_BUCKET_NAME',
      originalOnboardingContractsBucket.bucketName
    );

    lambdaFunctionForHCM.addEnvironment(
      'USER_DOCUMENTS_BUCKET_NAME',
      userDocumentsBucket.bucketName
    );

    // // Add permissions to TPI Lambda function to access S3 buckets
    lambdaFunctionForTPI.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:PutObject',
          's3:GetObject',
          's3:ListBucket', // this is often needed for presigned URLs or validating the object
        ],
        resources: [
          originalOnboardingContractsBucket.bucketArn,
          `${originalOnboardingContractsBucket.bucketArn}/*`,
          modifiedOnboardingContractsBucket.bucketArn,
          `${modifiedOnboardingContractsBucket.bucketArn}/*`,
          userDocumentsBucket.bucketArn,
          `${userDocumentsBucket.bucketArn}/*`,
        ],
      })
    );

    lambdaFunctionForTPI.addEnvironment(
      'USER_DOCUMENTS_BUCKET_NAME',
      userDocumentsBucket.bucketName
    );

    lambdaFunctionForTPI.addEnvironment(
      'ORIGINAL_CONTRACTS_BUCKET_NAME',
      originalOnboardingContractsBucket.bucketName
    );
    lambdaFunctionForTPI.addEnvironment(
      'MODIFIED_CONTRACTS_BUCKET_NAME',
      modifiedOnboardingContractsBucket.bucketName
    );

    // Add permissions to ESign Processor Lambda function to access S3 buckets
    eSignProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
        resources: [
          originalOnboardingContractsBucket.bucketArn,
          `${originalOnboardingContractsBucket.bucketArn}/*`,
          modifiedOnboardingContractsBucket.bucketArn,
          `${modifiedOnboardingContractsBucket.bucketArn}/*`,
          userDocumentsBucket.bucketArn,
          `${userDocumentsBucket.bucketArn}/*`,
        ],
      })
    );

    eSignProcessorLambda.addEnvironment(
      'ORIGINAL_CONTRACTS_BUCKET_NAME',
      originalOnboardingContractsBucket.bucketName
    );
    eSignProcessorLambda.addEnvironment(
      'MODIFIED_CONTRACTS_BUCKET_NAME',
      modifiedOnboardingContractsBucket.bucketName
    );

    //#endregion

    //#region SES Integration
    lambdaFunctionForPCH.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // Add SES permissions to HCM Lambda function
    lambdaFunctionForHCM.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail'],
        resources: ['*'],
      })
    );

    lambdaFunctionForTPI.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    lambdaFunctionForRevOps.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    //#endregion

    //#region SNS Integration

    // Add SNS permissions to the main Lambda function
    lambdaFunctionForPCH.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: ['*'],
      })
    );

    //#endregion

    // Add CloudWatch permissions to TPI Lambda function for EMF logging
    lambdaFunctionForTPI.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    //#region API Gateway Routes
    const signupResource = api.root.addResource('signup');
    signupResource.addMethod('POST', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    const pchoSignupResource = api.root.addResource('pcho-signup');

    pchoSignupResource.addMethod('POST', pchIntegration);

    const homeAdminSignupResource = api.root.addResource('home-admin-signup');

    homeAdminSignupResource.addMethod('POST', pchIntegration);

    const accountActivationResource = api.root.addResource('activate-account');

    accountActivationResource.addMethod('POST', pchIntegration);

    const resetPasswordResource = api.root.addResource('reset-password');
    resetPasswordResource.addMethod('PUT', pchIntegration);

    const confirmResetPasswordResource = api.root.addResource('confirm-reset-password');
    confirmResetPasswordResource.addMethod('PUT', pchIntegration);

    const signinResource = api.root.addResource('signin');
    signinResource.addMethod('POST', pchIntegration);

    const updatePasswordResource = api.root.addResource('update-password');
    updatePasswordResource.addMethod('PUT', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    const refreshTokenResource = api.root.addResource('refresh-token');
    refreshTokenResource.addMethod('POST', pchIntegration);

    // Define the 'v1' resource
    const v1 = api.root.addResource('v1');

    // Attach the Cognito Authorizer at the root level
    v1.addMethod('ANY', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add specific resources under /v1
    const usersResource = v1.addResource('users');
    const userResource = v1.addResource('user');
    const userIdResource = userResource.addResource('{id}');
    // add resource for clinical data
    const clinicalResource = v1.addResource('clinical');
    const clinicalUserResource = clinicalResource.addResource('user');
    const clinicalUserIdResource = clinicalUserResource.addResource('{id}');
    const s3PresignedUrlResource = v1.addResource('s3-pre-signed-url');
    const rBACResource = v1.addResource('rbac');
    const hcmResource = v1.addResource('hcm');
    const hcmShiftResource = hcmResource.addResource('shift');
    const hcmShiftsResource = hcmResource.addResource('shifts');
    const hcmGetShiftsByUserIdResource = hcmShiftsResource.addResource('user').addResource('{id}');
    const hcmUpdateAndDeleteShiftResource = hcmShiftResource.addResource('{id}');
    const hcmUpsertTeamRoasterResource = hcmResource.addResource('roaster');
    const hcmGetTeamRoasterResource = hcmResource.addResource('roasters');
    const homeResource = v1.addResource('home');
    const homeIdResource = homeResource.addResource('{id}');
    const initiateESignResource = v1.addResource('initiate-esign');
    const eSignWebhookResource = v1.addResource('esign-webhook');
    const sqsJobStatusRoute = v1.addResource('sqs-job-status').addResource('{id}');

    const hcmCreateBroadcastResource = hcmResource.addResource('broadcast');
    const hcmGetBroadcastsResource = hcmResource.addResource('broadcasts');
    const hcmCommunicationResource = hcmResource.addResource('communication');
    const hcmUpsertConversationResource = hcmCommunicationResource.addResource('conversation');
    const hcmGetUserConversationResource = hcmCommunicationResource.addResource('conversations');
    const hcmUpsertConversationMessagesResource =
      hcmUpsertConversationResource.addResource('message');
    const hcmGetConversationMessagesResource = hcmUpsertConversationResource
      .addResource('{id}')
      .addResource('messages');
    const embeddedSignResource = v1.addResource('slug-url');
    const docusealResource = v1.addResource('docuseal');
    const docusealBuilderTokenResource = docusealResource.addResource('builder-token');
    const docusealCreateSubmissionResource = docusealResource.addResource('create-submission');
    const homeTourResource = userResource.addResource('home-tour');
    const performanceResource = v1.addResource('performance');
    const webVitalsResource = performanceResource.addResource('web-vitals');
    const supportResource = v1.addResource('support');
    const notificationsResource = v1.addResource('notifications');
    const notificationEventsResource = notificationsResource.addResource('events');
    const notificationDevicesResource = notificationsResource.addResource('devices');
    const notificationDeviceIdResource = notificationDevicesResource.addResource('{deviceId}');
    const generateCertificateResource = v1
      .addResource('compliance')
      .addResource('generate-certificate');

    //Payments
    const revopsResource = v1.addResource('revops');
    const createInvoiceResource = revopsResource.addResource('invoice');
    const updateInvoiceResource = createInvoiceResource.addResource('{id}');
    const payoutResource = revopsResource.addResource('payout');
    const paymentResource = revopsResource.addResource('payment');
    const updatePayoutResource = payoutResource.addResource('{id}');
    const updatePaymentResource = paymentResource.addResource('{id}');
    const stripeResource = revopsResource.addResource('stripe');
    const stripeCreateAccountResource = stripeResource.addResource('create-account');
    const stripeWebhookResource = stripeResource.addResource('webhook');
    const stripeOnboardingLinkResource = stripeResource.addResource('onboarding-link');
    const crmResource = v1.addResource('crm');
    const upsertCampaignResource = crmResource.addResource('campaign');
    const getSalesMetricsResource = crmResource.addResource('sales').addResource('metrics');
    const budgetResource = revopsResource.addResource('budget');
    const updateBudgetResource = budgetResource.addResource('{id}');
    const getBudgetDashboardMetricsResource = budgetResource
      .addResource('dashboard')
      .addResource('metrics');

    // Add methods to the clinical resource
    clinicalUserIdResource.addMethod('PUT', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    // Connect all routes to the same Lambda function
    usersResource.addMethod('GET', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    userIdResource.addMethod('GET', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    userIdResource.addMethod('PUT', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    userIdResource.addMethod('DELETE', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    userResource.addMethod('POST', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    homeTourResource.addMethod('POST', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    s3PresignedUrlResource.addMethod('GET', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    rBACResource.addMethod('GET', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    rBACResource.addMethod('PUT', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    homeResource.addMethod('PUT', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    homeIdResource.addMethod('GET', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmResource.addMethod('ANY', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmShiftResource.addMethod('POST', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmShiftsResource.addMethod('GET', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmGetShiftsByUserIdResource.addMethod('GET', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmUpdateAndDeleteShiftResource.addMethod('PUT', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmUpdateAndDeleteShiftResource.addMethod('DELETE', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmUpsertTeamRoasterResource.addMethod('PUT', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmGetTeamRoasterResource.addMethod('GET', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    createInvoiceResource.addMethod('GET', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    createInvoiceResource.addMethod('POST', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    updateInvoiceResource.addMethod('PUT', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    payoutResource.addMethod('POST', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    payoutResource.addMethod('GET', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    updatePayoutResource.addMethod('PUT', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    updatePayoutResource.addMethod('DELETE', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    paymentResource.addMethod('POST', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    paymentResource.addMethod('GET', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    updatePaymentResource.addMethod('PUT', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    budgetResource.addMethod('POST', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    budgetResource.addMethod('GET', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    updateBudgetResource.addMethod('PUT', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    getBudgetDashboardMetricsResource.addMethod('GET', revOpsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    initiateESignResource.addMethod('POST', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    stripeCreateAccountResource.addMethod('POST', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });
    stripeOnboardingLinkResource.addMethod('POST', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    stripeWebhookResource.addMethod('POST', tpiIntegration);

    eSignWebhookResource.addMethod('POST', tpiIntegration);

    embeddedSignResource.addMethod('POST', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    docusealBuilderTokenResource.addMethod('POST', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    docusealCreateSubmissionResource.addMethod('POST', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    sqsJobStatusRoute.addMethod('GET', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmCreateBroadcastResource.addMethod('POST', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmGetBroadcastsResource.addMethod('GET', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmUpsertConversationResource.addMethod('PUT', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmGetUserConversationResource.addMethod('GET', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmUpsertConversationMessagesResource.addMethod('PUT', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    hcmGetConversationMessagesResource.addMethod('GET', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    webVitalsResource.addMethod('POST', tpiIntegration);

    notificationsResource.addMethod('POST', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    notificationEventsResource.addMethod('GET', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    notificationDevicesResource.addMethod('POST', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    notificationDeviceIdResource.addMethod('DELETE', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    generateCertificateResource.addMethod('POST', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    supportResource.addMethod('POST', tpiIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    upsertCampaignResource.addMethod('PUT', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    getSalesMetricsResource.addMethod('GET', pchIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    const taskResource = v1.addResource('task');
    const taskIdResource = taskResource.addResource('{id}');
    const tasksResource = v1.addResource('tasks');
    const taskDailyTrackingResource = v1.addResource('task-daily-tracking');

    taskResource.addMethod('POST', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    tasksResource.addMethod('GET', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    taskIdResource.addMethod('PUT', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    taskIdResource.addMethod('DELETE', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    taskDailyTrackingResource.addMethod('GET', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    taskDailyTrackingResource.addMethod('PUT', hcmIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    });

    //#endregion

    //#region CORS Policies
    //add cors policy

    signupResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    pchoSignupResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    accountActivationResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    signinResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    resetPasswordResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    confirmResetPasswordResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    updatePasswordResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    refreshTokenResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    v1.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    taskResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    tasksResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    taskIdResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    taskDailyTrackingResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    userResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    homeTourResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    usersResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    userIdResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });
    // add cors policy for clinical data
    clinicalResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });
    // add cors policy for clinical data by user id
    clinicalUserIdResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    s3PresignedUrlResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    rBACResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    homeResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    homeIdResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmShiftResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmShiftsResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmGetShiftsByUserIdResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmUpdateAndDeleteShiftResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT', 'DELETE'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmUpsertTeamRoasterResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmGetTeamRoasterResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    initiateESignResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    eSignWebhookResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    embeddedSignResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    docusealBuilderTokenResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    docusealCreateSubmissionResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    sqsJobStatusRoute.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmCreateBroadcastResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmGetBroadcastsResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmUpsertConversationResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmGetUserConversationResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmUpsertConversationMessagesResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    hcmGetConversationMessagesResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    webVitalsResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    generateCertificateResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    createInvoiceResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST', 'GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    updateInvoiceResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    payoutResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST', 'GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    updatePayoutResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT', 'DELETE'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    updatePaymentResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    paymentResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST', 'GET', 'PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    stripeCreateAccountResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    stripeOnboardingLinkResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    stripeWebhookResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    notificationDevicesResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    notificationDeviceIdResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['DELETE'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    supportResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    upsertCampaignResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    budgetResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST', 'GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    updateBudgetResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['PUT'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    getBudgetDashboardMetricsResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    getSalesMetricsResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET'],
      allowHeaders: ['Authorization', 'Content-Type', ...apigateway.Cors.DEFAULT_HEADERS],
    });

    //#endregion

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'WSAPIEndpoint', {
      value: wsStage.url,
    });
  }
}
