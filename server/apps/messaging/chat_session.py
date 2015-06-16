# -*- coding: utf-8; -*-
#
# This file is part of Superdesk.
#
# Copyright 2013, 2014 Sourcefabric z.u. and contributors.
#
# For the full copyright and license information, please see the
# AUTHORS and LICENSE files distributed with this source code, or
# at https://www.sourcefabric.org/superdesk/license

from eve.utils import config
from apps.archive.common import get_user

from superdesk import Resource, Service, get_resource_service
from superdesk.errors import SuperdeskApiError

CHAT_SESSIONS = 'chat_sessions'


class ChatResource(Resource):
    schema = {
        'creator': Resource.rel('users', required=False),
        'users': {'type': 'list', 'schema': Resource.rel('users', required=True)},
        'desks': {'type': 'list', 'schema': Resource.rel('desks', required=True)},
        'groups': {'type': 'list', 'schema': Resource.rel('groups', required=True)}
    }
    resource_methods = ['GET', 'POST']
    datasource = {'default_sort': [('_created', -1)]}


class ChatService(Service):

    def on_create(self, docs):
        for doc in docs:
            sent_user = doc.get('creator', None)
            user = get_user()
            if sent_user and sent_user != str(user.get('_id')):
                message = 'Creating a chat session on behalf of someone else is prohibited.'
                raise SuperdeskApiError.forbiddenError(message)
            creator = str(user.get('_id'))
            doc['creator'] = creator

    def on_fetched(self, docs):
        for doc in docs:
            doc['recipients'] = self.resolve_message_recipients(doc[config.ID_FIELD])

    def on_fetched_item(self, doc):
        doc['recipients'] = self.resolve_message_recipients(doc[config.ID_FIELD])

    def resolve_message_recipients(self, chat_session_id):
        """
        De-normalizes the chat session if it's tied to either desk or group or both.
        :return: User ID list
        """
        recipients = set()

        chat_session = get_resource_service(CHAT_SESSIONS).find_one(req=None, _id=chat_session_id)

        if len(chat_session.get('users', [])):
            recipients.update([str(user) for user in chat_session['users']])

        if len(chat_session.get('desks', [])):
            query = {'$and': [{config.ID_FIELD: {'$in': chat_session['desks']}}]}
            desks = list(get_resource_service('desks').get(req=None, lookup=query))

            recipients.update([str(member['user']) for desk in desks for member in desk.get('members', [])])

        if len(chat_session.get('groups', [])):
            query = {'$and': [{config.ID_FIELD: {'$in': chat_session['groups']}}]}
            groups = list(get_resource_service('groups').get(req=None, lookup=query))

            recipients.update([str(member['user']) for group in groups for member in group.get('members', [])])

        return list(recipients)
