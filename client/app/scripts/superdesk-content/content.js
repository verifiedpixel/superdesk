
(function() {
    'use strict';

    angular.module('superdesk.content', [
        'superdesk.activity',
        'superdesk.aggregate'
    ])

        .controller('Content', ContentController)
        .controller('ListLayout', ListLayoutController)

        .directive('sdListLayout', ListLayoutDirective)
        .directive('sdStageItems', StageItemListDirective)
        .directive('sdContentGroup', ContentGroupDirective)
        .directive('sdContentGroupHeader', ContentGroupHeaderDirective)

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

    function ContentGroupHeaderDirective() {
        return {
            templateUrl: 'scripts/superdesk-content/views/content-group-header.html'
        };
    }

    ContentGroupDirective.$inject = ['search', 'api', 'superdesk', 'desks', '$timeout'];
    function ContentGroupDirective(search, api, superdesk, desks, $timeout) {
        var ITEM_HEIGHT = 57,
            ITEMS_COUNT = 5,
            BUFFER = 8,
            UP = -1,
            DOWN = 1,
            ENTER_KEY = 13,
            MOVES = {
                38: UP,
                40: DOWN
            };

        return {
            require: '^sdListLayout',
            templateUrl: 'scripts/superdesk-content/views/content-group.html',
            link: function(scope, elem, attrs, listLayout) {

                scope.view = 'compact';
                scope.page = 1;
                scope.fetching = false;
                scope.cacheNextItems = [];
                scope.cachePreviousItems = [];

                scope.uuid = uuid;
                scope.select = select;
                scope.preview = preview;
                scope.renderNew = renderNew;

                scope.$watch('group', queryItems);
                scope.$on('task:stage', handleStage);
                scope.$on('ingest:update', update);

                var list = elem[0].getElementsByClassName('inline-content-items')[0],
                    scrollElem = elem.find('.stage-content').first();

                scrollElem.on('keydown', handleKey);
                scrollElem.on('scroll', handleScroll);
                scope.$on('$destroy', function() {
                    scrollElem.off();
                });

                var criteria,
                    updateTimeout,
                    moveTimeout;

                function handleStage(event, data) {
                    if (data.new_stage === scope.stage || data.old_stage === scope.stage) {
                        update();
                    }
                }

                function select(item) {
                    scope.selected = item;
                }

                function preview(item) {
                    select(item);
                    listLayout.openItem(item);
                }

                function queryItems() {
                    var query = search.query({});
                    query.filter({term: {'task.stage': scope.group._id}});
                    query.size(0); // we just need to get total number of items

                    if (scope.queryString) {
                        query.filter({query: {query_string: {
                            query: scope.queryString,
                            lenient: false
                        }}});
                    }

                    criteria = {source: query.getCriteria()};

                    scope.loading = true;
                    scope.total = null;
                    return apiquery().then(function(items) {
                        scope.total = items._meta.total;
                        scope.$applyAsync(render);
                    })['finally'](function() {
                        scope.loading = false;
                    });
                }

                function render() {
                    var top = scrollElem[0].scrollTop,
                        start = Math.floor(top / ITEM_HEIGHT),
                        from = Math.max(0, start - BUFFER),
                        to = Math.min(scope.total, start + ITEMS_COUNT + BUFFER);

                    if (parseInt(list.style.height, 10) !== scope.total * ITEM_HEIGHT) {
                        list.style.height = (scope.total * ITEM_HEIGHT) + 'px';
                    }

                    criteria.source.from = from;
                    criteria.source.size = to - from;
                    return apiquery().then(function(items) {
                        scope.$applyAsync(function() {
                            if (scope.total !== items._meta.total) {
                                scope.total = items._meta.total;
                                list.style.height = (scope.total * ITEM_HEIGHT) + 'px';
                            }

                            list.style.paddingTop = (from * ITEM_HEIGHT) + 'px';
                            scope.items = merge(items._items);
                        });
                    });
                }

                function apiquery(query) {
                    return api.query('archive', query ? {source: query} : criteria);
                }

                function renderNew() {
                    scope.total += scope.newItemsCount;
                    scope.newItemsCount = 0;
                    render();
                }

                function merge(newItems) {
                    var next = [],
                        olditems = scope.items || [];
                    angular.forEach(newItems, function(item) {
                        var old = _.find(olditems, {_id: item._id});
                        next.push(old ? angular.extend(old, item) : item);
                    });

                    return next;
                }

                function updateCurrentView() {
                    var ids = _.pluck(scope.items, '_id'),
                        query = {query: {filtered: {filter: {and: [
                            {terms: {_id: ids}},
                            {term: {'task.stage': scope.stage}}
                        ]}}}};
                    query.size = ids.length;
                    apiquery(query).then(function(items) {
                        var nextItems = _.indexBy(items._items, '_id');
                        angular.forEach(scope.items, function(item, i) {
                            var diff = nextItems[item._id] || {_deleted: 1};
                            angular.extend(item, diff);
                        });
                    });
                }

                function update() {
                    if (scrollElem[0].scrollTop || scope.selected) {
                        updateCurrentView();
                    } else {
                        render();
                    }
                }

                function handleScroll(event) {
                    $timeout.cancel(updateTimeout);
                    updateTimeout = $timeout(render, 100, false);
                }

                function handleKey(event) {
                    var code = event.keyCode || event.which;
                    if (MOVES[code]) {
                        event.preventDefault();
                        event.stopPropagation();
                        $timeout.cancel(updateTimeout);
                        move(MOVES[code], event);
                        handleScroll(); // make sure we scroll after moving
                    } else if (code === ENTER_KEY) {
                        scope.$applyAsync(function() {
                            preview(scope.selected);
                        });
                    }
                }

                function clickItem(item, event) {
                    scope.select(item);
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                    }
                }

                function move(diff, event) {
                    var index = _.findIndex(scope.items, scope.selected),
                        nextItem,
                        nextIndex;

                    if (index === -1) {
                        nextItem = scope.items[0];
                    } else {
                        nextIndex = Math.max(0, Math.min(scope.items.length - 1, index + diff));
                        nextItem = scope.items[nextIndex];

                        $timeout.cancel(moveTimeout);
                        moveTimeout = $timeout(function() {
                            var top = scrollElem[0].scrollTop,
                                topItemIndex = Math.ceil(top / ITEM_HEIGHT),
                                bottomItemIndex = Math.floor((top + scrollElem[0].clientHeight) / ITEM_HEIGHT),
                                nextItemIndex = nextIndex + criteria.source.from;
                            if (nextItemIndex < topItemIndex) {
                                scrollElem[0].scrollTop = Math.max(0, nextItemIndex * ITEM_HEIGHT);
                            } else if (nextItemIndex >= bottomItemIndex) {
                                scrollElem[0].scrollTop = (nextItemIndex - ITEMS_COUNT + 1) * ITEM_HEIGHT;
                            }
                        }, 50, false);
                    }

                    scope.$apply(function() {
                        clickItem(scope.items[nextIndex], event);
                    });
                }
            }
        };

        function uuid(item) {
            return item._id;
        }
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
