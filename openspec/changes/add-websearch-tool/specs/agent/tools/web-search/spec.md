# Spec Delta

## Purpose

Equips the agent with the ability to query the web to supplement job description analysis with missing or contextual information, such as company details or salary estimates.

## ADDED Requirements

### Requirement: Agent can execute web searches
The system SHALL provide a web search tool to the agent that returns search results for a given query.

#### Scenario: Agent looks up missing company info
- **WHEN** the agent analyzes a job description missing the hiring company's background
- **THEN** the agent invokes the web search tool with the company name
- **THEN** the search tool returns relevant snippets or URLs
- **THEN** the agent includes the discovered company context in its final analysis output

### Requirement: Agent can verify or estimate salary using web search
The system SHALL allow the agent to use the web search tool to find market salary data when estimating salaries.

#### Scenario: Agent estimates salary for a role
- **WHEN** the job description lacks explicit salary information
- **THEN** the agent invokes the web search tool with the job title and location
- **THEN** the search tool returns market salary averages
- **THEN** the agent uses this data to estimate the salary range and notes it as estimated

