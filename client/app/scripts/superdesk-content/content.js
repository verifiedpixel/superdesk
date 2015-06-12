
(function() {
    'use strict';

    angular.module('superdesk.content', [
        'superdesk.activity',
        'superdesk.aggregate'
    ])

        .controller('Content', ContentController)
        .controller('ListLayout', ListLayoutController)

        .directive('sdListLayout', ListLayoutDirective)
        .directive('sdContentGroup', ContentGroupDirective)
        .directive('sdContentGroupHeader', ContentGroupHeaderDirective)
        .directive('sdStageItems', StageItemListDirective)

        .config(contentConfig)
        ;

    function ContentController() {
        this.view = null;
    }

    ListLayoutController.$inject = ['preferences'];
    function ListLayoutController(preferences) {
        var MAX_VIEW = Object.freeze({max: true}),
            MIN_VIEW = Object.freeze({min: true}),
            ITEM_VIEW = Object.freeze({extended: true}),
            COMPACT_VIEW = Object.freeze({compact: true});

        this.view = MAX_VIEW;

        this.openItem = openItem;
        this.closeItem = closeItem;
        this.closeList = closeList;
        this.openList = openList;
        this.closeEditor = closeEditor;
        this.compactView = toggleCompactView;
        this.extendedView = toggleExtendedView;

        var vm = this,
            listView;

        return activate();

        function activate() {
            preferences.get('list:view').then(function(listPreferences) {
                listView = listPreferences && listPreferences.view === 'compact' ? COMPACT_VIEW : ITEM_VIEW;
            });
        }

        function openItem(item) {
            vm.item = item;
            openList();
        }

        function closeItem() {
            vm.item = null;
            closeEditor();
        }

        function closeList() {
            vm.view = MIN_VIEW;
        }

        function openList() {
            vm.view = listView;
        }

        function closeEditor() {
            vm.view = MAX_VIEW;
        }

        function toggleCompactView() {
            vm.view = listView = COMPACT_VIEW;
            savePreferences();
        }

        function toggleExtendedView() {
            vm.view = listView = ITEM_VIEW;
            savePreferences();
        }

        function savePreferences() {
            var view = Object.keys(vm.view)[0];
            preferences.update({'list:view': {view: view}}, 'list:view');
        }
    }

    function ListLayoutDirective() {
        return {
            controller: 'ListLayout',
            controllerAs: 'layout'
        };
    }

    function ContentGroupDirective() {
        return {
            templateUrl: 'scripts/superdesk-content/views/content-group.html'
        };
    }

    function ContentGroupHeaderDirective() {
        return {
            templateUrl: 'scripts/superdesk-content/views/content-group-header.html'
        };
    }

    StageItemListDirective.$inject = ['search', 'api', 'superdesk', 'desks', '$timeout', '$q', '$location', '$anchorScroll'];
    function StageItemListDirective(search, api, superdesk, desks, $timeout, $q, $location, $anchorScroll) {
        return {
            templateUrl: 'scripts/superdesk-desks/views/stage-item-list.html',
            scope: {
                stage: '=?',
                savedSearch: '=?',
                total: '=',
                allowed: '=',
                showEmpty: '=?',
                selected: '=?',
                action: '&',
                filter: '='
            },
            link: function(scope, elem) {

                scope.page = 1;
                scope.fetching = false;
                scope.cacheNextItems = [];
                scope.cachePreviousItems = [];
                var query = search.query(scope.savedSearch ? scope.savedSearch.filter.query : {});
                var criteria = {source: query.getCriteria()};

                scope.preview = function(item) {
                    desks.setWorkspace(item.task.desk, item.task.stage);
                    superdesk.intent('read_only', 'content_article', item);
                };

                scope.edit = function(item) {
                    desks.setWorkspace(item.task.desk, item.task.stage);
                    superdesk.intent('author', 'article', item);
                };

                function queryItems(queryString) {
                    query = search.query(scope.savedSearch ? scope.savedSearch.filter.query : {});
                    if (scope.stage) {
                        query.filter({term: {'task.stage': scope.stage}});
                    }
                    query.size(25);

                    if (queryString) {
                        query.filter({query: {query_string: {
                            query: queryString,
                            lenient: false
                        }}});
                    }
                    criteria = {source: query.getCriteria()};
                    scope.loading = true;
                    scope.items = scope.total = null;
                    api('archive').query(criteria).then(function(items) {
                        scope.items = items._items;
                        scope.total = items._meta.total;

                        scope.cachePreviousItems = items._items;
                        setNextItems(criteria);
                    })['finally'](function() {
                        scope.loading = false;
                    });

                }

                scope.$watch('filter', queryItems);
                scope.$on('task:stage', function(event, data) {
                    if (scope.stage && (data.new_stage === scope.stage || data.old_stage === scope.stage)) {
                        queryItems();
                    }
                });

                var container = elem[0];
                var offsetY = 0;
                elem.bind('scroll', function() {
                    scope.$apply(function() {
                        if (container.scrollTop + container.offsetHeight >= container.scrollHeight - 3) {
                            container.scrollTop = container.scrollTop - 3;
                            scope.fetchNext();
                        }
                        if (container.scrollTop <= 2) {
                            offsetY = 2 - container.scrollTop;
                            container.scrollTop = container.scrollTop + offsetY;
                            scope.fetchPrevious();
                        }
                    });
                });
                scope.fetchNext = function() {
                    if (!scope.fetching) {
                        if (scope.cacheNextItems.length > 0) {
                            scope.fetching = true;
                            scope.page = scope.page + 1;

                            criteria.source.from = (scope.page) * criteria.source.size;
                            scope.loading = true;

                            if (scope.items.length > criteria.source.size){
                                scope.cachePreviousItems = _.slice(scope.items, 0, criteria.source.size);
                                scope.items.splice(0, criteria.source.size);
                            }
                            $timeout(function() {
                                if (!_.isEqual(scope.items, scope.cacheNextItems)) {
                                    scope.items = scope.items.concat(scope.cacheNextItems);
                                }
                            }, 100);

                            api('archive').query(criteria)
                            .then(function(items) {
                                scope.cacheNextItems = items._items;
                                scope.fetching = false;
                            }, function() {
                                //
                            })
                            ['finally'](function() {
                                scope.loading = false;
                            });
                        }
                    } else {
                        return $q.when(false);
                    }
                };
                scope.fetchPrevious = function() {
                    if (!scope.fetching && scope.page > 2) {
                        scope.fetching = true;
                        scope.page = scope.page - 1;
                        if (scope.page > 2) {
                            criteria.source.from = (scope.page - 3) * criteria.source.size;
                        } else {
                            criteria.source.from = 0;
                        }
                        scope.loading = true;

                        if (scope.items.length > criteria.source.size) {
                            scope.cacheNextItems = _.slice(scope.items,
                                scope.items.length - (scope.items.length - criteria.source.size), scope.items.length);
                            scope.items.splice(scope.items.length - (scope.items.length - criteria.source.size), criteria.source.size);
                        }

                        $timeout(function() {
                            scope.items.unshift.apply(scope.items, scope.cachePreviousItems);
                            if (scope.items.length > 0) {
                                scrollList(scope.items[parseInt(((scope.items.length - 1) / 2), 10)]._id);
                            }
                        }, 100);

                        api('archive').query(criteria)
                        .then(function(items) {
                            scope.cachePreviousItems = items._items;
                            scope.fetching = false;
                        })
                        ['finally'](function() {
                            scope.loading = false;
                        });
                    } else {
                        return $q.when(false);
                    }
                };
                function setNextItems(criteria) {
                    criteria.source.from = scope.page * criteria.source.size;
                    return api('archive').query(criteria)
                        .then(function(items) {
                            scope.cacheNextItems = items._items;
                        });
                }
                function scrollList(id) {
                    $location.hash(id);
                    $anchorScroll();
                }

                var UP = -1,
                    DOWN = 1;

                var code;
                elem.on('keyup', function(e) {
                    scope.$apply(function() {
                        if (e.keyCode) {
                            code = e.keyCode;
                        } else if (e.which) {
                            code = e.which;
                        }
                        if (code === 38) { scope.move(UP, e); }
                        if (code === 40) {
                            e.preventDefault();
                            scope.move(DOWN, e);
                        }
                    });
                });

                scope.move = function (diff, event) {
                    if (scope.selected != null && (scope.selected.task.stage === scope.stage)) {
                        if (scope.items) {
                            var index = _.findIndex(scope.items, {_id: scope.selected._id});
                            if (index === -1) { // selected not in current items, select first
                                clickItem(_.first(scope.items), event);
                            }
                            var nextIndex = _.max([0, _.min([scope.items.length - 1, index + diff])]);
                            if (nextIndex < 0) {
                                clickItem(_.last(scope.items), event);
                            }
                            if (index !== nextIndex) {
                                scrollList(scope.items[nextIndex]._id);
                                clickItem(scope.items[nextIndex], event);
                            } else {
                                if (event) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    event.stopImmediatePropagation();
                                }
                            }
                        }
                    }
                };
                function clickItem(item, $event) {
                    scope.select(item);
                    if ($event) {
                        $event.preventDefault();
                        $event.stopPropagation();
                        $event.stopImmediatePropagation();
                    }
                }
                scope.select = function(view) {
                    this.selected = view;
                };
            }
        };
    }

    contentConfig.$inject = ['superdeskProvider'];
    function contentConfig(superdesk) {
        /* globals: gettext */
        superdesk
            .activity('/workspace/content', {
                label: gettext('Workspace'),
                priority: 100,
                controller: 'Content',
                controllerAs: 'content',
                templateUrl: 'scripts/superdesk-content/views/content.html',
                topTemplateUrl: 'scripts/superdesk-dashboard/views/workspace-topnav.html',
                filters: [{action: 'view', type: 'content'}],
                privileges: {archive: 1}
            });
    }

})();
