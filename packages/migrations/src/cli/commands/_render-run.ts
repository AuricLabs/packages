import { indent } from '../format';

import type { MigrationRecord } from '../../types';

/**
 * Render a single MigrationRecord's detail (description, error, result,
 * output) for terminal display. Returns a multi-line string with sections
 * separated by blank lines. Empty when the record has no detail content.
 */
export function renderRunDetail(record: MigrationRecord): string {
  const sections: string[] = [];

  if (record.description?.trim()) {
    sections.push(section('Description', record.description.trim()));
  }

  if (record.error) {
    sections.push(section('Error', record.error));
  }

  if (record.metadata && Object.keys(record.metadata).length > 0) {
    sections.push(section('Result', JSON.stringify(record.metadata, null, 2)));
  }

  if (record.output) {
    let body = record.output.trimEnd();
    if (record.outputTruncated) {
      body = '[output exceeded the storage cap; oldest lines were dropped]\n\n' + body;
    }
    sections.push(section('Output', body));
  }

  if (sections.length === 0) {
    return indent('(no description, result, or captured output)', 2) + '\n';
  }

  return sections.join('\n\n') + '\n';
}

function section(title: string, body: string): string {
  return `  ${title}:\n${indent(body, 4)}`;
}
