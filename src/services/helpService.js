import { changelog } from '../mock/changelog';
import { faqCategories, helpFaqList } from '../mock/helpFaq';
import { systemStatusList } from '../mock/systemStatus';
import { ticketStatuses, ticketTypes, ticketUrgencies, tickets } from '../mock/tickets';
import { troubleshootingList } from '../mock/troubleshooting';
import { tutorialCategories, tutorials } from '../mock/tutorials';

export function getFaqList() {
  return helpFaqList;
}

export function getFaqCategories() {
  return faqCategories;
}

export function getTroubleshootingList() {
  return troubleshootingList;
}

export function getTickets() {
  return tickets;
}

export function getTicketTypes() {
  return ticketTypes;
}

export function getTicketUrgencies() {
  return ticketUrgencies;
}

export function getTicketStatuses() {
  return ticketStatuses;
}

export function getTutorials() {
  return tutorials;
}

export function getTutorialCategories() {
  return tutorialCategories;
}

export function getSystemStatus() {
  return systemStatusList;
}

export function getChangelog() {
  return changelog;
}
