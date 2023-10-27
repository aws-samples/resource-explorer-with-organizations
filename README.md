## Cross-account Resource monitoring with AWS Organizations and Resource Explorer 

There are use cases where users are eager to find lingering resources, or resources that were not at their optimal settings.

By utilising Resource Explorer and Step Functions, we can perform workloads over multiple accounts within an organisation. We can therefore gather all the necessary information from these accounts, and use them to create a report to gain a wider understanding of the state of your AWS accounts. 

However, We can deploy this to all our accounts in our AWS Organization using StackSets [(See Here)](https://docs.aws.amazon.com/resource-explorer/latest/userguide/manage-service-all-org-with-stacksets.html). This would allow us to perform single queries across accounts to get all resources of specific types.

The other reason it would be useful to explore the resource explorer is that it allows for querying against multiple parameters; for instance, it allows you to filter on untagged instances of certain types. This might form the basis for finding untagged resources in the future, and can be worked into a workload to detect untagged resources, and alert the necessary people. 

It is also a good tool to enable just for discoverability, and for alerting. It allows you to search for resources based on a variety of parameters, and go directly to the resource find.

The use case we are demonstrating here is to find RDS instances in an account over multiple regions, and create an Excel Document out of them. 

### Services

* AWS Organizations: We need to use AWS Organizations, in order to deploy the necessary stack set and enable resource explorer in all accounts. 
* Step Functions: We use step functions to organise the flow for each AWS account. 
* Lambda: Lambda runs the functions necessary to get the information about each resource. 
* AWS Resource Explorer: Searches for Resources across regions within an account. 
* S3: Store the resulting output. 

### Output

For this workload the output would be a correctly formatted Excel file. This would allow the user to do complex filtering over a variety of parameters in order to detect workloads that are primed for further investigation. 

The excel file will contain  a number of parameters, and worksheets. It will contain a worksheet per account, and include things like the ARN, some performance settings (example given were CPU and database connections). 

Having this overview, and enabling it in Excel, allows you to usudo kise complicated Excel functions to filter RDS, which enables you to get a better view of which RDS Databases are not currently in use. 

An Example of the Excel Worksheet is shown below. 

![Pasted image 20230726164846.png](./docs/images/OutputExample.png)


### Architecture Diagram
![Diagram.png](./docs/images/Diagram.png)

### Workload Diagram
![Pasted image 20230726164747.png](./docs/images/StepFunctionWorkload.png)

### Getting Started

Follow the step by step guide [here](./docs/GettingStarted.md) 


