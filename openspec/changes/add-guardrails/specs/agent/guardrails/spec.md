# Spec Delta

## Purpose

Adds an input validation layer using TypeSafe AI's Jev model to ensure the agent only analyzes valid job descriptions, rejecting arbitrary or irrelevant text.

## ADDED Requirements

### Requirement: Validate input as a job description
The system SHALL evaluate the user's input text before passing it to the main analysis agent, using a probabilistic guardrail model to determine if the text is a valid job description.

#### Scenario: User provides a valid job description
- **WHEN** the user inputs a valid job description
- **THEN** the guardrail check passes
- **THEN** the system proceeds with the main job description analysis

#### Scenario: User provides arbitrary text
- **WHEN** the user inputs text that is not a job description (e.g., source code, irrelevant articles)
- **THEN** the guardrail check fails
- **THEN** the system immediately rejects the input and returns a clear error message to the user without invoking the main analyzer

