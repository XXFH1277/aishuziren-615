import { changelog } from '../mock/changelog';
import { faqCategories, helpFaqList } from '../mock/helpFaq';
import { systemStatusList } from '../mock/systemStatus';
import { ticketStatuses, ticketTypes, ticketUrgencies, tickets } from '../mock/tickets';
import { troubleshootingList } from '../mock/troubleshooting';
import { tutorialCategories, tutorials } from '../mock/tutorials';
import { apiRequest } from './request';

export async function getFaqList(params = {}) {
  return apiRequest.get('/api/help/faq', params);
}

export function getFaqCategories() {
  return faqCategories;
}

export async function getTroubleshootingList(params = {}) {
  return apiRequest.get('/api/help/troubleshooting', params);
}

export async function getTickets(params = {}) {
  return apiRequest.get('/api/help/tickets', params);
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

export async function createTicket(data) {
  const result = await apiRequest.post('/api/help/tickets', data);
  return result.ticket;
}

export async function getTutorials(params = {}) {
  return apiRequest.get('/api/help/tutorials', params);
}

export function getTutorialCategories() {
  return tutorialCategories;
}

export async function getSystemStatus(params = {}) {
  return apiRequest.get('/api/help/status', params);
}

export async function getChangelog(params = {}) {
  return apiRequest.get('/api/help/changelog', params);
}

export function getMockFaqList() {
  return helpFaqList;
}

export function getMockTroubleshootingList() {
  return troubleshootingList;
}

export function getMockTickets() {
  return tickets;
}

export function getMockTutorials() {
  return tutorials;
}

export function getMockSystemStatus() {
  return systemStatusList;
}

export function getMockChangelog() {
  return changelog;
}
