'use strict';

describe('superdesk.content', function() {

    beforeEach(module('superdesk.content'));

    describe('layout', function() {
        it('can toggle display mode', inject(function($controller, $rootScope, $q, preferences) {
            spyOn(preferences, 'get').and.returnValue($q.when({view: 'extended'}));
            spyOn(preferences, 'update');

            var scope = $rootScope.$new(),
                ctrl = $controller('ListLayout', {$scope: scope});

            $rootScope.$digest();

            expect(preferences.get).toHaveBeenCalledWith('list:view');
            expect(ctrl.view.max).toBeTruthy();

            ctrl.openItem();
            expect(ctrl.view.extended).toBeTruthy();
            expect(ctrl.view.max).toBeFalsy();

            ctrl.closeList();
            expect(ctrl.view.min).toBeTruthy();
            expect(ctrl.view.extended).toBeFalsy();
            expect(ctrl.view.max).toBeFalsy();

            ctrl.openList();
            expect(ctrl.view.extended).toBeTruthy();
            expect(ctrl.view.min).toBeFalsy();
            expect(ctrl.view.max).toBeFalsy();

            ctrl.compactView();
            expect(ctrl.view.compact).toBeTruthy();
            expect(ctrl.view.extended).toBeFalsy();
            expect(preferences.update).toHaveBeenCalledWith({'list:view': {view: 'compact'}}, 'list:view');

            ctrl.closeList();
            ctrl.openList();
            expect(ctrl.view.compact).toBeTruthy();
            expect(ctrl.view.extended).toBeFalsy();

            ctrl.extendedView();
            expect(ctrl.view.extended).toBeTruthy();
            expect(ctrl.view.compact).toBeFalsy();

            ctrl.closeEditor();
            expect(ctrl.view.max).toBeTruthy();
            expect(ctrl.view.min).toBeFalsy();
            expect(ctrl.view.compact).toBeFalsy();
            expect(ctrl.view.extended).toBeFalsy();

            ctrl.openItem();
            expect(ctrl.view.extended).toBeTruthy();
            expect(ctrl.view.min).toBeFalsy();
            expect(ctrl.view.max).toBeFalsy();
            expect(ctrl.view.compact).toBeFalsy();

            ctrl.closeItem();
            expect(ctrl.view.max).toBeTruthy();
            expect(ctrl.view.min).toBeFalsy();
            expect(ctrl.view.extended).toBeFalsy();
            expect(ctrl.view.compact).toBeFalsy();
        }));
    });
});
