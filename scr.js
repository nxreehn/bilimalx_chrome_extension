let group_push = false; //признак нажато ли групповое проставление или нет
let group_marks = []; //массив для сбора групповых оценок
(function () {
    let grading = {};
    // выбранная ячейка в таблице
    let td_active;
    // выбранная оценка если ред/удал
    let mark_active;
    let params = {
        'group_id' : definedParams.g_id,
        'year' : definedParams.year,
        's_id' : definedParams.s_id,
        'training_type' : definedParams.training_type
    };
    let lplan_elem;
    let sor_soch = [21, 22]; // TODO СОр или СОч (доделать галочку)

    grading.egv_labels = [];
    grading.lplans = [];
    grading.lplans['tasks'] = [];
    if (definedParams && definedParams.ltask_sdot_data && typeof definedParams.ltask_sdot_data == "object") {
        grading.lplans['tasks'] = definedParams.ltask_sdot_data;
    }

    grading.lplans['tests'] = [];
    grading.lplans_result = [];
    grading.lplans_result['tasks'] = [];
    grading.lplans_result['tests'] = [];
    grading.prev_results_status = null;
    grading.prev_results_id = null;

    if (definedParams.egv && typeof definedParams.egv == 'object') {
        definedParams.egv.forEach(function (row) {
            grading.egv_labels[row.label] = row.htmlOptions.id;
        });
    }

    grading.getfromSdot = function (type, id, callback) {

        if (type == undefined) {
            type = 'tasks';
        }

        $.ajax({
            type: "GET",
            url: SDOT_API + "/school/"+type+"/" + id,
            headers: {
                'x-organization-id': SDOT_ORG_ID,
                'Authorization': 'Bearer ' + SDOT_TOKEN
            },
            crossDomain: true,
            dataType: "json",
            success: function (data) {
                grading.lplans[type][data.id] = data;

                if (typeof callback == "function") {
                    callback.call();
                }
            }
        });
    }

    grading.getTestsResultsFromSdot = function (test_id, callback) {
        $.ajax({
            type: "GET",
            url: SDOT_API + "/school/test-results?test_id=" + test_id,
            headers: {
                'x-organization-id': SDOT_ORG_ID,
                'Authorization': 'Bearer ' + SDOT_TOKEN
            },
            crossDomain: true,
            dataType: "json",
            success: function (data) {
                if (typeof grading.lplans_result['tests'][test_id] == "undefined") {
                    grading.lplans_result['tests'][test_id] = [];
                }

                if (data.length > 0) {
                    data.forEach(row => {
                        grading.lplans_result['tests'][test_id][row.bilimal_user_id] = row;
                    })
                }

                if (typeof callback == "function") {
                    callback.call();
                }
            }
        });
    };

    grading.getFromThis = function (url, callback) {
        $.ajax({
            type: "GET",
            url: url,
            dataType: "json",
            success: function (data) {
                if (typeof callback == "function") {
                    callback(data);
                }
            }
        });
    };

    grading.appendRecord = function(yModel, type, link_id, record_id, pupil_id) {

        if ($('#'+type+'_'+link_id+'_'+record_id+'_'+pupil_id).length > 0) {
            $('#'+type+'_'+link_id+'_'+record_id+'_'+pupil_id).remove();
        }

        if (grading.lplans[type][record_id] == undefined) {
            grading.getfromSdot(type, record_id, function () {
                grading.appendRecord(yModel, type, link_id, record_id, pupil_id);
            });
        } else {
            if (type === 'tests') {
                if (grading.lplans_result['tests'] && grading.lplans_result['tests'][record_id]) {
                    if (grading.lplans_result['tests'][record_id].length > 0 && grading.lplans_result['tests'][record_id][pupil_id]) {
                        var data = grading.lplans_result['tests'][record_id][pupil_id];
                        var statusTmpl = $('#' + type + 'StatusListTmpl').tmpl({status: (data.status ? data.status : 0)}).html();
                    } else {
                        var statusTmpl = $('#' + type + 'StatusListTmpl').tmpl({status: 0}).html();
                    }

                    $('#recordListTmpl').tmpl({
                        name: grading.lplans[type][record_id].name,
                        type: type,
                        link_id: link_id,
                        record_id: record_id,
                        pupil_id: pupil_id,
                        status: statusTmpl
                    }).appendTo('div#modalmark #modal_' + type + ' .' + type + '-container');
                } else {
                    grading.getTestsResultsFromSdot(record_id, function (data) {
                        grading.appendRecord(yModel, type, link_id, record_id, pupil_id);
                    });
                }
            } else {
                grading.getFromThis('/asu/request?yModel='+yModel+'&'+yModel+'[lplans_'+type+'_id]=' + link_id + '&'+yModel+'[pupil_id]=' + pupil_id, function (data) {
                    if (typeof grading.lplans_result[type][link_id] == "undefined") {
                        grading.lplans_result[type][link_id] = [];
                    }
                    grading.lplans_result[type][link_id][pupil_id] = data;

                    var statusTmpl = $('#'+type+'StatusListTmpl').tmpl({ status : (data && data.status ? data.status : 0) }).html();

                    $('#recordListTmpl').tmpl({
                        name : grading.lplans[type][record_id].name,
                        type : type,
                        link_id : link_id,
                        record_id : record_id,
                        pupil_id : pupil_id,
                        status : statusTmpl
                    }).appendTo('div#modalmark #modal_'+type+' .'+type+'-container');
                });
            }

        }
    };

    grading.changeStatusResults = function(id, status, prev_status) {
        if (status != 5 || (status == 5 && prev_status != null)) {
            grading.prev_results_status = prev_status;
            grading.prev_results_id = id;
            $.ajax({
                type: "PUT",
                url: "/asu/request",
                data: JSON.stringify({
                    yModel : "LplansTasksResults",
                    LplansTasksResults : {
                        id: id,
                        status: status
                    }
                }),
                dataType: "json",
                contentType: "application/json",
                success: function (data) {
                    if (typeof data == "object") {
                        grading.lplans_result['tasks'][data.lplans_tasks_id][data.pupil_id] = data;
                    }
                },
                error: function () {
                    $.jGrowl(Yii.t('main', 'Ошибка при сохранении'),
                        {
                            sticky: false,
                            theme: 'error'
                        });

                }
            });
        }
    };

    window.revertStatusResults = function() {
        if (grading.prev_results_status !== null) {
            grading.changeStatusResults(grading.prev_results_id, grading.prev_results_status, null)
        }
    };


    window.showTask = function(record_id, link_id, pupil_id) {

        grading.prev_results_status = null;
        grading.prev_results_id = null;

        var record = grading.lplans['tasks'][record_id];
        var modal_body = $('#tasksModal').find('.modal-body');
        var modal_footer = $('#tasksModal').find('.modal-footer');

        modal_body.find('.task-container').hide();

        modal_body.find('input,textarea').val('');
        modal_body.find('input[name="link_id"]').val(link_id);
        modal_body.find('input[name="record_id"]').val(record_id);
        modal_body.find('input[name="pupil_id"]').val(pupil_id);

        $('#tasksModal').find('.modal-title').html('<i class="fa fa-user"></i> ' + td_active.parents('tr').find('td.pupil_name').html());

        // задание
        modal_body.find('.task-title-container').empty();
        modal_body.find('.task-container .content-container').empty();
        $('#taskTitleTmpl').tmpl(record).appendTo(modal_body.find('.task-title-container'));
        $('#taskContentTmpl').tmpl(record).appendTo(modal_body.find('.task-container .content-container'));

        modal_body.find('.task-container .files-container .files-list').empty();

        var files;
        if (record.info && record.info.files) {
            files = record.info.files;
        } else if (record.files) {
            files = record.files;
        }
        if (files && files.length > 0) {
            modal_body.find('.task-container .files-container').show();
            files.forEach(row => {
                $('#filesTmpl').tmpl(row).appendTo(modal_body.find('.task-container .files-container .files-list'));
            });
        } else {
            modal_body.find('.task-container .files-container').hide();
        }


        // решение ученика
        var result = grading.lplans_result['tasks'][link_id][pupil_id];
        var lastUpdatedDate = result.ts; // дата и время последнего ответа ученика

        $.each(result.lplansTasksResultsStatusLog, function (i, e) {
            // 1 = Сдано, отправлено - ученик отправил
            // 4 = Сдано повторно - ученик отправил повторно
            if (e.status === 1 || e.status === 4) {
                lastUpdatedDate = e.ts;
            }
        });

        result['answerDate'] = moment(lastUpdatedDate).format('DD.MM.YYYY / HH:mm');
        modal_body.find('.message-container').show();
        modal_body.find('.message-container .content-container').empty();
        modal_body.find('.status-container .content-container').empty();

        modal_body.find('.result-container .content-container').empty();
        modal_body.find('.result-container .files-container').hide();
        modal_body.find('.result-container .files-container .files-list').empty();

        if (result.id) {

            // активируем кнопки
            modal_footer.find('.btn-accept-task').prop('disabled', false);
            modal_footer.find('.btn-return-task').prop('disabled', false);

            if (result.status == 2) {
                modal_footer.find('.btn-accept-task').prop('disabled', true);
            }

            if (result.status == 3) {
                modal_footer.find('.btn-return-task').prop('disabled', true);
            }

            if (result.status != 2 && result.status != 3 && result.status != 6) {
                grading.changeStatusResults(result.id, 5, result.status);
            }


            modal_body.find('input[name="task_result_id"]').val(result.id);

            $('#resultTmpl').tmpl(result).appendTo(modal_body.find('.result-container .content-container'));

            modal_body.find('.result-container .files-container .files-list').empty();

            if (result.files) {
                var files = JSON.parse(result.files);
            }

            if (files && files.length > 0) {
                modal_body.find('.result-container .files-container').show();
                files.forEach(row => {
                    $('#filesTmpl').tmpl(row).appendTo(modal_body.find('.result-container .files-container .files-list'));
                });
            } else {
                modal_body.find('.result-container .files-container').hide();
            }


            // комментарии
            grading.getFromThis('/asu/request?yModel=ChatMessage&ChatMessage[table_name]=college_process.lplans_tasks_results&ChatMessage[record_id]=' + result.id, function (data) {
                // console.log('data',data);
                data.forEach(function (row) {
                    $('#chatMessageTmpl').tmpl(row).appendTo(modal_body.find('.message-container .content-container'));
                });
            });

        } else {
            modal_body.find('.result-container .content-container').html( $('#resultEmptyTmpl').tmpl());

            // деактивируем кнопки
            modal_footer.find('.btn-return-task').prop('disabled', true);
            modal_footer.find('.btn-accept-task').prop('disabled', true);

        }

        $('#tasksStatusListTmpl').tmpl({ status : (result.status ? result.status : 0) }).appendTo(modal_body.find('.status-container .content-container'));

        if (window.MathJax) {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
        }
    };

    window.showTest = function(record_id, link_id, pupil_id) {

        var record = grading.lplans['tests'][record_id];

        var modal_body = $('#testsModal').find('.modal-body');
        var modal_footer = $('#testsModal').find('.modal-footer');

        modal_body.find('.test-container').hide();

        modal_body.find('input,textarea').val('');
        modal_body.find('input[name="link_id"]').val(link_id);
        modal_body.find('input[name="record_id"]').val(record_id);
        modal_body.find('input[name="pupil_id"]').val(pupil_id);

        $('#testsModal').find('.modal-title').html('<i class="fa fa-user"></i> ' + td_active.parents('tr').find('td.pupil_name').html());

        // задание
        modal_body.find('.test-title-container').empty();
        modal_body.find('.test-container .content-container').empty();
        $('#testTitleTmpl').tmpl({
            id: record.id,
            pupil_id: pupil_id
        }).appendTo(modal_body.find('.test-title-container'));
        $('#testContentTmpl').tmpl(record).appendTo(modal_body.find('.test-container .content-container'));

        // решение ученика
        var result = grading.lplans_result['tests'][record_id][pupil_id];
        modal_body.find('.result-container .content-container').empty();
        modal_body.find('.message-container').hide();
        modal_body.find('.message-container .content-container').empty();
        modal_body.find('.status-container .content-container').empty();


        if (result.id) {

            // активируем кнопки
            modal_footer.find('.btn-accept-test').prop('disabled', false);
            modal_footer.find('.btn-return-test').prop('disabled', false);

            if (result.status == 2) {
                modal_footer.find('.btn-accept-test').prop('disabled', true);
            }

            if (result.status == 3 || result.status == 6) {
                modal_footer.find('.btn-return-test').prop('disabled', true);
            }

            modal_body.find('input[name="test_result_id"]').val(result.id);

            result['answerDate'] = moment(result.finished).format('DD.MM.YYYY / HH:mm');

            $('#testResultTmpl').tmpl(result).appendTo(modal_body.find('.result-container .content-container'));

            // комментарии
            grading.getFromThis('/asu/request?yModel=ChatMessage&ChatMessage[table_name]=college_process.lplans_tests_results&ChatMessage[record_id]=' + result.id, function (data) {
                console.log('data',data);
                data.forEach(function (row) {
                    $('#chatMessageTmpl').tmpl(row).appendTo(modal_body.find('.message-container .content-container'));
                });
            });

        } else {
            modal_body.find('.result-container .content-container').html( $('#resultEmptyTmpl').tmpl());

            // деактивируем кнопки
            modal_footer.find('.btn-return-test').prop('disabled', true);
            modal_footer.find('.btn-accept-test').prop('disabled', true);

        }

        $('#testsStatusListTmpl').tmpl({ status : (result.status ? result.status : 0) }).appendTo(modal_body.find('.status-container .content-container'));
    };


    window.openModal = function(td, a) {
        window.restart();
        td_active = td;
        mark_active = a;
        let egv = td.data('egv');
        let lessonView = td.data('lesson_view');
        if (egv && $.isNumeric(egv)) {
            egv = egv.toString();
        }

        let egv_array = [];
        let modalContainer = $('div#modalmark');

        params = {
            'group_id': definedParams.g_id,
            'year': definedParams.year,
            's_id': definedParams.s_id,
            'training_type': definedParams.training_type,
            'mark_type_label': definedParams.mark_type_label
        };

        if (td.data('comment') === 0) {
            $('div#modal_comment').hide();
        } else {
            $('div#modal_comment').show();
        }

        if (td.data('theme') !== undefined) {
            lplan_elem = td;
        } else {
            lplan_elem = td.closest('table').find('tr:first th').eq(td.index()).find('a');
            grading.tdAttrToParams(lplan_elem.data());
        }
        params.p_id = parseInt(td.parents('tr').find('td.pupil_name a').attr('id'));
        params.id = a.data('id');
        // рекомендуемая оценка
        params.rec_mark = td.attr('rec_mark');

        grading.tdAttrToParams(td.data());

        // задаем инфу для модального окна
        modalContainer.find('span#modal_pupil_name').html(td.parents('tr').find('td.pupil_name').html());
        if (lplan_elem.data('theme') !== undefined) {
            modalContainer.find('span#modal_theme_name').html(lplan_elem.data('theme'));
            modalContainer.find('#modal_theme').show();
        } else {
            modalContainer.find('#modal_theme').hide();
        }

        if (lplan_elem.data('s_date') !== undefined) {
            modalContainer.find('span#modal_lplan_date').html(lplan_elem.data('s_date'));
            modalContainer.find('#modal_date').show();
        } else {
            modalContainer.find('#modal_date').hide();
        }


        // Задания
        modalContainer.find('#modal_tasks .tasks-container').empty();
        if (params.ltasks !== undefined) {
            var ltasks = params.ltasks.split(',');

            var pupil_id = td_active.parents('tr').attr('pupil_id');
            ltasks.forEach(k => {
                var kk = k.split('_');
                grading.appendRecord('LplansTasksResults', 'tasks', kk[0], kk[1], pupil_id);
            });

            modalContainer.find('#modal_tasks').show();
        } else {
            modalContainer.find('#modal_tasks').hide();
        }


        // Тесты
        modalContainer.find('#modal_tests .tests-container').empty();
        if (params.tests !== undefined) {
            var tests = params.tests.split(',');

            var pupil_id = td_active.parents('tr').attr('pupil_id');
            tests.forEach(k => {
                var kk = k.split('_');
                grading.appendRecord('LplansTestsResults', 'tests', kk[0], kk[1], pupil_id);
            });

            modalContainer.find('#modal_tests').show();
        } else {
            modalContainer.find('#modal_tests').hide();
        }

        if (params.model === 'CMarks') {
            // СОР и СОЧ это тоже CMarks
            if ($.isPlainObject(params.mark_type_label)) {
                modalContainer.find('span#mmodal_type_of_mark').html(params.mark_type_label[lessonView]);
            } else {
                modalContainer.find('span#mmodal_type_of_mark').html(params.mark_type_label);
            }
        } else {
            modalContainer.find('span#mmodal_type_of_mark').html(td.closest('table').find('tr:first th').eq(td.index()).html());
        }


        // обновляем форму модалки
        // кнопки
        modalContainer.find('#modal_marks a.btn').hide();
        // текст поля
        modalContainer.find('#modalMarksAddUpdate .egv-field').hide();


        //?
        modalContainer.find('input#period_type').val(td.attr('q_num'));


        // console.log('egv',egv);
        // загрузка кнопок или инпутов для выставления оценок
        if (egv !== undefined) {
            if (egv.indexOf(',') !== -1) {
                egv_array = egv.split(',');
                egv_array.forEach(function (id) {
                    modalContainer.find('#modal_marks a#' + id).show();
                    grading.showInputField(modalContainer.find('#modalMarksAddUpdate .modal-field[data-egv_id=' + id + ']'), id, a);
                });
            } else {
                modalContainer.find('#modal_marks a#' + egv).show();
                grading.showInputField(modalContainer.find('#modalMarksAddUpdate .modal-field[data-egv_id=' + egv + ']'), egv, a);
            }
        } else {
            modalContainer.find("#modal_ok_button").prop("disabled", true);
        }


        // задаем значения для полей
        modalContainer.find('textarea#comment').val(a.data('comment'));

        // console.log('params.id', params.id);
        if (params.id > 0) {
            // update
            //modalContainer.find('input#m_id').val(params.id);
            //modalContainer.find('a#'+a.data('egv_id')+'').addClass('active');
            modalContainer.find('a#'+a.data('egv_id')+'').addClass('active');
            modalContainer.find('#modal_delete_button').show();
            modalContainer.find('textarea#comment').val(a.data('comment'));
        } else {
            //modalContainer.find('input#m_id').val('');
            modalContainer.find('#modal_delete_button').hide();
            modalContainer.find('textarea#comment').val('');
        }



        //? TODO тестить в стр за четверть
        // modalContainer.find('input#quarter').val(elem.closest('table').find('tr:first th').eq( elem.index() ).find('a').attr('id'));
        // if (modalContainer.find('input#quarter').val() == '') {
        //     // Для Суммативного оценивания в Критериальном журнале
        //     modalContainer.find('input#quarter').val(elem.parent().find('td').eq( 2 ).attr('quarter'));
        // }
        //
        // var qrt = parseInt(elem.closest('table').find('tr:first th').eq( elem.index() ).find('a').attr('id'));
        // if (qrt<5) {
        //     modalContainer.find('div#modal_quarter .quarter').show();
        //     modalContainer.find('div#modal_quarter .half').hide();
        // } else if (qrt>4) {
        //     modalContainer.find('div#modal_quarter .quarter').hide();
        //     modalContainer.find('div#modal_quarter .half').show();
        // }
        // if (qrt === 5) {
        //     qrt = 1;
        // }
        // if (qrt === 6) {
        //     qrt = 2;
        // }
        // modalContainer.find('div#modal_quarter span#modal_quarter_number').html(qrt);


        modalContainer.modal('show');
    };


    grading.tdAttrToParams = function (lplan_elem_data) {
        if (typeof lplan_elem_data !== 'object') {
            return;
        }
        for (let k in lplan_elem_data){
            if (['limit','egv'].indexOf(k) !== -1) {
                continue;
            }
            if (lplan_elem_data.hasOwnProperty(k)) {
                params[k] = lplan_elem_data[k];
            }
        }
    };

    grading.showInputField = function (input_field, egv, a) {
        if (input_field === undefined) {
            return;
        }
        input_field.show();
        input_field.find('.egv-inp').val('');
        if (egv == a.data('egv_id')){
            input_field.find('.egv-inp').val(a.html());
            input_field.find('.egv-inp').addClass('active');
        }
    };


    grading.saveMark = function (params, onOk, onErr, onComplete) {
        $.ajax({
            type: "POST",
            url: '/gradebook/marks/saveMark',
            data: params,
            dataType: "json",
            success: function (data) {
                if (data.status === 'ok') {
                    Notify.showMsg(data);
                    if (onOk) {
                        onOk(data)
                    }

                    if (data.fo_ball === undefined) {
                        //Проставление в ячейку оценки Зачёт\Не зачёт
                        $('tr[pupil_id^=' + data.p_id + '] td.is-add[data-q_num=' + data.q_num + ']').html(
                            '<a data-id="' + data.id + '" data-comment  data-egv_id="' + data.egv_id + '" style="float: none" class="tooltipster mark_symbol is-update">' + data.mark_symbol + '</a>' +
                            '<div id="tasks" style="display: flex; align-items: center; justify-content: flex-end; padding: 5px;" data-bg="none"></div>'
                        );
                    } else {
                        //Проставление в ячейку оценки ФО
                        let mark = (data.fo_ball !== null) ? data.fo_ball : data.mark_symbol;
                        $('tr#' + data.p_id + ' td.is-add[data-lp_id=' + data.lp_id + ']').html(
                            '<a data-id="' + data.id + '" data-comment  data-egv_id="' + data.egv_id + '" style="float: none" class="tooltipster mark_symbol is-update">' + mark + '</a>' +
                            '<div id="tasks" style="display: flex; align-items: center; justify-content: flex-end; padding: 5px;" data-bg="none"></div>'
                        );
                    }
                    $('#modalmark').children('#modalMarksAddUpdate').find('#modal_ok_button').prop('disabled', '');
                }
                if (data.status === 'err') {
                    Notify.showMsg(data);
                    if (onErr) {
                        onErr(data)
                    }
                }
            },
            error: function () {
                // $.jGrowl(Yii.t('main', 'Ошибка при сохранении'),
                //     {
                //         sticky: false,
                //         theme: 'error'
                //     });
                if (onErr) {
                    onErr({})
                }
            },
            complete: function () {
                // $('div#modalmark').modal('hide');

                if (onComplete) {
                    onComplete();
                }
            }
        });
    };

    window.saveTaskResult = function (status) {
        var taskModal = $('#tasksModal');

        $.ajax({
            type: "PUT",
            url: "/asu/request",
            data: JSON.stringify({
                yModel : "LplansTasksResults",
                LplansTasksResults : {
                    id: parseInt(taskModal.find('input[name="task_result_id"]').val()),
                    status: status,
                    message: taskModal.find('textarea[name="message"]').val()
                }
            }),
            dataType: "json",
            contentType: "application/json",
            success: function (data) {
                grading.appendRecord('LplansTasksResults', 'tasks', taskModal.find('input[name="link_id"]').val(), taskModal.find('input[name="record_id"]').val(), taskModal.find('input[name="pupil_id"]').val());
                grading.prev_results_status = null;
                taskModal.modal('hide');
            },
            error: function () {
                $.jGrowl(Yii.t('main', 'Ошибка при сохранении'),
                    {
                        sticky: false,
                        theme: 'error'
                    });

            }
        });
    };

    window.saveTestResult = function (status) {
        var testModal = $('#testsModal');

        $.ajax({
            type: "PUT",
            url: "/asu/request",
            data: JSON.stringify({
                yModel : "LplansTestsResults",
                LplansTestsResults : {
                    id: parseInt(testModal.find('input[name="test_result_id"]').val()),
                    status: status,
                    message: testModal.find('textarea[name="message"]').val()
                }
            }),
            dataType: "json",
            contentType: "application/json",
            success: function (data) {
                grading.appendRecord('LplansTestsResults', 'tests', testModal.find('input[name="link_id"]').val(), testModal.find('input[name="record_id"]').val(), testModal.find('input[name="pupil_id"]').val());
                testModal.modal('hide');
            },
            error: function () {
                $.jGrowl(Yii.t('main', 'Ошибка при сохранении'),
                    {
                        sticky: false,
                        theme: 'error'
                    });

            }
        });
    };

    window.restart = function (egv_id) {
        params.egv_id = egv_id;
        // console.log('restart');
        $('.so-mark-ball').val('');
        $('input[name="inputMark"]').detach();
        $('div#GradebookMarkList table tbody tr div.markControls').remove();
        $('div#marks_add').removeClass('active');
        $('div#modal_marks a').removeClass('active');
        // $('div#modal_comment').hide();

        // удаляем контейнер для группового выст оценок
        $('div.add').removeClass('active');
        $('div.editable-container').remove();

        // ? $('div#container').remove();
    };


    grading.loadTestFromSdot = function (record_id, callback) {
        if (grading.lplans['tests'][record_id]['questions'] == undefined) {
            $.ajax({
                type: "GET",
                url: SDOT_API + "/school/questions?test_id=" + record_id + "&fields=id,name,type,weight,correct_count,is_random,answers,user_id&expand=answers",
                headers: {
                    'x-organization-id': SDOT_ORG_ID,
                    'Authorization': 'Bearer ' + SDOT_TOKEN
                },
                crossDomain: true,
                dataType: "json",
                success: function (data) {
                    grading.lplans['tests'][record_id]['questions'] = data;

                    if (typeof callback == "function") {
                        callback.call(data);
                    }
                }
            });
        } else {
            if (typeof callback == "function") {
                callback.call(grading.lplans['tests'][record_id]['questions']);
            }
        }
    };

    window.showTestQuestion = function (record_id, pupil_id) {
        grading.loadTestFromSdot(record_id, function () {
            var modal_body = $('#testsModal').find('.modal-body');
            modal_body.find('.test-container .question-container .question-list').empty();
            // $('#testContentTmpl').tmpl(record).appendTo(modal_body.find('.test-container .content-container'));

            var data = grading.lplans['tests'][record_id]['questions'];
            if (data && data.length > 0) {
                modal_body.find('.test-container .question-container').show();
                data.forEach(row => {
                    $('#questionTmpl').tmpl(row).appendTo(modal_body.find('.test-container .question-container .question-list'));
                });

                // решение ученика
                var result = grading.lplans_result['tests'][record_id][pupil_id];
                if (result) {
                    for (let k in result.info.answers){
                        var el_q = $('.question-list #test-q-' + k);
                        for (let kk in result.info.answers[k]){
                            el_q.find('#test-a-' + result.info.answers[k][kk].id).addClass('bg-primary text-white');
                        }
                    }
                }
            } else {
                modal_body.find('.test-container .question-container').hide();
            }
        });
    };

    grading.changeColorAverage = function (id) {

        let average = 0;
        let mark_count = 0;
        let total = 0;
        $('tr#'+id+' td.current a.mark_symbol').each(function() {
            if ($.isNumeric($(this).html())) {
                total = total + parseInt($(this).html());
                mark_count++;
            }
        });
        // подсчет средней оценки
        if (mark_count > 0) {
            average = parseFloat(total/mark_count).toFixed(2);
        }
        // определяем цвет для средней оценки
        let span_class = '';
        if (average > 5) {$('td.average').html('<span class="">'+average+'</span>');}
        if (average >= 4.5 && average <= 5) {span_class = 'dark_green';}
        if (average >= 3.5 && average < 4.5) {span_class = 'green';}
        if (average >= 2.5 && average < 3.5) {span_class = 'yellow';}
        if (average > 0 && average <= 2.5) {span_class = 'red';}

        if (average > 0) {
            $('tr#'+id+' td.average').html('<span class="'+span_class+'">'+average+'</span>');
        } else {
            $('tr#'+id+' td.average').html('<span>-</span>');
        }
    };

    // проверка на кол-во выставляемых оценок
    grading.checkLimitMark = function () {
        let limit = td_active.data('limit');
        let marks_count = td_active.find('a.mark_symbol').length;
        if (limit <= marks_count) {
            td_active.children('div.mark-plus').remove();
        } else {
            //условие для изначалой загрузки js если удалять имеющуюся оценку - добавлять "плюсик"
            if (td_active.find('#tasks').empty()) {
                td_active.find('#tasks').append('<div class="mark-plus">+</div>');
            }
            if (td_active.find('#tasks').length == 0) {
                td_active.append('<div class="mark-plus">+</div>');
                if (td_active.hasClass('is-add') === false) {
                    td_active.addClass('is-add');
                }
            }
        }
    };

    // ф-я на проверку существует ли аттрибут
    $.fn.hasAttr = function(name) {
        return this.attr(name) !== undefined && this.attr(name) !== false && this.attr(name) !== null;
    };

    // обновление текущей ячейки из собранных данных - тестов\заданий
    $(document.body).on('hidden.bs.modal', '#modalmark', function () {
        // все завязано на атрибутах data-ltasks, data-tests если хотя бы один из них существует и не равен пустому значению ...
        if((td_active.hasAttr('data-ltasks') && td_active.attr('data-ltasks') !== '') ||
            (td_active.hasAttr('data-tests') && td_active.attr('data-tests') !== '')) {
            // собирается общее кол-во, и кол-во выполненных заданий и тестов
            var tasks = grading.collectTaskTest('ltasks');
            var tests = grading.collectTaskTest('tests');
            var bgColor = 'none';
            var fontColor = 'black';

            // устанавливается цвет ячейки и текста ... в случаях если есть задания\тесты для ученика и если еще не выставлена оценка
            if ((tasks.total !== 0 || tests.total !== 0) && td_active.find(".mark_symbol").length === 0) {
                if (tasks.totalAccepted === 0 && tests.totalAccepted === 0) {
                    bgColor = '#ffdada';
                    fontColor = '#dc7575';
                } else if (tasks.totalAccepted === tasks.total && tests.totalAccepted === tests.total) {
                    bgColor = '#d7fbd7';
                    fontColor = '#67905e';
                } else {
                    bgColor = '#fffbce';
                    fontColor = '#b7af4a';
                }

                // ... прямиком в атрибут bg и font
                td_active.find('#tasks').data('bg', bgColor);
                td_active.find('#tasks').data('font', fontColor);

                bgColor = td_active.find('#tasks').data('bg');
                fontColor = td_active.find('#tasks').data('font');

                // формирование ячейки
                td_active.css('background-color', bgColor);
                td_active.find('#tasks').html(
                    '<div style="padding-right: 7px;color: '+fontColor+'">'+tasks.totalAccepted+'/'+tasks.total+'<br>'+tests.totalAccepted+'/'+tests.total+'</div><div class="mark-plus">+</div>'
                );
            }
        }
    });

    // сбор данных по тестам\заданиям
    grading.collectTaskTest = function(dataName) {
        var total = 0;
        var totalAccepted = 0;
        var containerName = dataName === 'ltasks' ? 'tasks' : dataName;

        if(td_active.attr('data-' + dataName) !== undefined) {
            total = td_active.data(dataName) === '' ? 0 : td_active.data(dataName).split(',').length;
        }

        if(total !== 0) {
            $.each($(document).find('#modalMarksAddUpdate .' + containerName + '-container').children(), function(i,v) {
                if($(v).find('.unaccepted').length === 0) totalAccepted++;
            });
        }

        return {total: total, totalAccepted: totalAccepted};
    };


    window.saveMark = function (egv_id, mark_text, inputs) {

        if (egv_id === undefined
            && (inputs[0]['name'] == 'comment' && (inputs[0]['value'] == '' || inputs[0]['value'] === undefined))
        ) {
            Notify.showMsg({status:'err', text:'Не выбрана оценка'});
            return false;
        }

        console.log('saveMark');
        if (params.model === 'CMarks') {
            grading.changeColorAverage(params.p_id);
        }

        if (td_active && td_active.data('q_num')) {
            params.q_num = td_active.data('q_num');
        }

        if (egv_id) {
            params.egv_id = egv_id;
        } else if(mark_text == '' || mark_text === undefined){
            //Слов.
            egv_id = 11;
            params.egv_id = 11;
        }

        if (mark_text) {
            params.mark_text = mark_text;
        }

        // для input полей, Например: ball
        if (inputs !== undefined && typeof inputs == 'object') {
            inputs.forEach(function (item) {
                // если название input поля совпадает с уже имеющимся - то сохраняем как отдельное поле
                if (item.name == 'comment') {
                    params[item.name + 's'] = item.value; // = comments
                } else {
                    params[item.name] = item.value;
                }
            });
        }



        // if (mark_active) {
        //     mark_active.remove();
        // }

        if (mark_text == '' || mark_text === undefined) {

            let egv_inp_active = $('.egv-inp.active').val();

            if(egv_inp_active == '' || egv_inp_active === undefined){
                mark_text = 'Слов.';
            } else {
                mark_text = egv_inp_active;
            }
        }


        if (parseInt(egv_id) === 12) {
            if (grading.onValidateSor(mark_text) === false) {
                return;
            }
        }

        if (parseInt(egv_id) === 39) {
            if (! $.isNumeric(mark_text)) {
                Notify.showMsg({status:'err', text:'Не верный формат оценки'});
                return;
            }
        }

        params.comment = $('textarea#comment').val();

        if (params.comment === '') {
            params.comment = $('input#11').val();
        }

        if (params.comment === undefined) {
            params.comment = '';
        }
        let tmp_key = params.p_id+params.lp_id;
        td_active.find('a[data-id=' + params.id + ']').remove();
        td_active.append('<a class="mark_symbol is-update temp"  temp="'+tmp_key+'" data-comment="'+params.comment+'" style="float: none;">'+mark_text+'</a>');

        let onOk = function(result){
            let tmp_el = $('a[temp="'+tmp_key+'"]');
            tmp_el.attr("data-id", result.id);
            tmp_el.attr("data-egv_id", egv_id);
            tmp_el.removeClass('temp');
            tmp_el.addClass('tooltipster');
            tmp_el.removeAttr('temp');
            tmp_el.siblings('#tasks').hide();
            tmp_el.siblings('.mark-plus').hide();
            tmp_el.parent('td').css('background-color', '');

            tmp_el.attr('title', "<b>Тема:</b>" + params.theme + "</br><b>Дата:</b>" + result.date + "</br><b>Комментарий:</b>" + result.comment);
            //Подсказка ломает выставление итоговых оценок
            //$(".tooltipster").tooltipster({'fixedWidth':'400','position':'right'});
            $('#modalmark').children('#modalMarksAddUpdate').find('#modal_ok_button').prop('disabled', '');
            $('div#modalmark').modal('hide');
        };

        let onErr = function(result){
            let tmp_el = $('a[temp="'+tmp_key+'"]');
            tmp_el.siblings('#tasks').show();
            tmp_el.siblings('#tasks').css('display', 'flex');
            tmp_el.remove();
            $('#modalmark').children('#modalMarksAddUpdate').find('#modal_ok_button').prop('disabled', '');
            $('div#modalmark').modal('hide');
        };

        grading.checkLimitMark();
        $('#modalmark').children('#modalMarksAddUpdate').find('#modal_ok_button').prop('disabled', 'true');
        if (group_push) {
            //заполнение массива оценками для массового проставления
            let tmp_g_marks = {
                'egv_id': egv_id, //вид оценки
                'mark_text': mark_text, //значение оценки
            };

            for (var i in params) {
                if (params.hasOwnProperty(i)) {
                    tmp_g_marks[i] = params[i];
                }
            }

            let found = false;
            for (let i = 0; i < group_marks.length; i++) {
                if (group_marks[i].p_id == tmp_g_marks.p_id) {
                    found = true;
                    group_marks[i] = tmp_g_marks;
                }
            }
            if (!found) {
                group_marks.push(tmp_g_marks);
            }
        } else {
            grading.saveMark(params, onOk, onErr, null);
        }
    };

    // для группового сохранения
    window.saveMarkGroup = function (elem) {
        td_active = elem.parent().parent();
        params.model = elem.parents('td').data('model');
        params.p_id = elem.parents('tr').find('td.pupil_name a').attr('id');
        params.lp_id = $('div#GradebookMarkList table thead tr').find('th:nth-child(' + (elem.parents('td').index() + 1) + ')').children('a').data('lp_id');
        params.date = $('div#GradebookMarkList table thead tr').find('th:nth-child(' + (elem.parents('td').index() + 1) + ')').children('a').data('date');

        while (td_active[0].childNodes.length > 1) {
            td_active[0].removeChild(td_active[0].lastChild);
        }

        if (elem.parents('td').data('q_num') !== undefined) {
            params.q_num = elem.parents('td').data('q_num');
        }

        window.saveMark(elem.attr('id'), elem.html(), '');
    };


    window.deleteMark = function () {
        $('#modalmark').children('#modalMarksAddUpdate').find('#modal_delete_button').prop('disabled', 'true');

        if (params.model === 'CMarks') {
            grading.changeColorAverage(params.p_id);
        }

        $.post('/gradebook/marks/deleteMark',
            params,
            function (result){
                var mark = td_active.find('a[data-id=' + result.id + ']');
                mark.siblings('#tasks').css('display', 'flex');
                mark.remove();
                grading.checkLimitMark();

                // костыль при удал балла
                if (result.egv_id === 12) {
                    $("#journal").load(location.href+" #journal");
                }
            },
            'json'
        ).done(function() {
            $('#modalmark').children('#modalMarksAddUpdate').find('#modal_delete_button').prop('disabled', '');
            $('#modalmark').modal('hide');
        });
    };

    //Диалоговое окно с редактором переходом на следующую ячейку при ENTER
    grading.showMarkAddInputDialog = function (td, index, onValidate, egv_id) {
        window.restart(egv_id);
        td_active = td;
        params.p_id = parseInt(td.parents('tr').find('td.pupil_name a').attr('id'));
        console.log('p_id', params.p_id);
        params.lp_id = td.data('lp_id');
        params.so_max_ball = new Number(td.parent().find('.max_ball_'+params.lp_id).data('max_ball'));
        params.date = td.data('date');
        params.id = td.find('a').data('id');


        let coord = grading.getCoords(td[0]);
        let d = new GBDialog($('#gb_so_mark_dialog'), coord);
        let mark = td.find('a').html();
        // console.log('mark', mark);
        d.onShow = function () {

            // console.log('showMarkAddInputDialog show');
            let dlg = this;
            let nex_td = false;
            let inp = dlg.createInput({'class': "so-mark-ball"});
            inp.setValue(mark);

            inp.onKeyPress = function (e) {
                // console.log('showMarkAddInputDialog e', e);
                if (e.which == 13) {
                    grading._stopEvent(e);
                    nex_td = grading.findNextTd(td, index);
                    // console.log('td', td);

                    if (nex_td && onValidate && onValidate(inp.getValue())) {
                        inp.el.focusout();
                        // dlg.close();
                        grading.showMarkAddInputDialog(nex_td, nex_td[0].parentNode.rowIndex, onValidate, egv_id);
                    }
                }
            };
            inp.onFocusOut = function (e) {
                console.log('onFoucsOut');

                if (onValidate && onValidate(inp.getValue()) && (mark === undefined || mark != inp.getValue())) { //
                    console.log('onFoucsOut', mark, inp.getValue());
                    window.saveMark(params.egv_id, inp.getValue());
                    let dlg = e.data.input.parent;
                    dlg.close();
                }

            };
            inp.initEvents();
            inp.focus();
        };
        d.show();
    };


    grading.onValidateSor = function(mark){
        if(mark == "") return false;

        if (params.so_max_ball =='' || !$.isNumeric(params.so_max_ball)){
            Notify.showMsg({status:'err', text:'Не задан максимальный балл'});
            return false;
        }

        if (!$.isNumeric(mark)) {
            Notify.showMsg({status:'err', text:'Значение должно быть числом'});
            return false;
        };
        let ball = new Number(mark);

        params.ball = ball;
        let b = ( ball >= 1) && (ball <= params.so_max_ball);
        if (!b) {
            Notify.showMsg({status:'err', text:'Значение должно быть между 1 и '+params.so_max_ball});
            return false;
        };

        return true;
    };

    grading.onValidate = function(mark){
        if(mark == '') return false;

        if (!$.isNumeric(mark)) {
            Notify.showMsg({status:'err', text:'Значение должно быть числом'});
            return false;
        };

        if (mark in grading.egv_labels) {
            params.egv_id = grading.egv_labels[mark];
            return true;
        } else {
            Notify.showMsg({status:'err', text:'Не правильное значение'});
            return false;
        }
    };


    grading.findNextTd = function (cur_td, rowIndex) {
        let lp_id = cur_td.data('lp_id');
        let tds = $('#GradebookMarkList td.is-add[data-lp_id=' + lp_id + ']');
        let len = tds.length;
        let cur_td_id = -1;
        //let rowIndex = cur_td[0].parentNode.rowIndex;
        let rowIndex2 = td_active[0].parentNode.rowIndex;
        //console.log('cur_td', cur_td);
        for (let i = 0; i < len; i++) {
            let cri = $(tds[i])[0].parentNode.rowIndex;
            //console.log('cri2', rowIndex, rowIndex2, cri, i);
            if (rowIndex === cri ) {
                //console.log('cri', rowIndex, cri, i);
                cur_td_id = i;
            }
        }
        if ((cur_td_id + 1) < len) {
            if ($(tds[cur_td_id + 1]))
                return $(tds[cur_td_id + 1]);
        }
        return null;
    };

    grading.getCoords = function (elem) {
        // (1)
        let box = elem.getBoundingClientRect();

        let body = document.body;
        let docEl = document.documentElement;

        // (2)
        let scrollTop = window.pageYOffset || docEl.scrollTop || body.scrollTop;
        let scrollLeft = window.pageXOffset || docEl.scrollLeft || body.scrollLeft;

        // (3)
        let clientTop = docEl.clientTop || body.clientTop || 0;
        let clientLeft = docEl.clientLeft || body.clientLeft || 0;

        // (4)
        let top = box.top + scrollTop - clientTop;
        let left = box.left + scrollLeft - clientLeft;

        return {
            top: top,
            left: left
        };
    };

    grading._stopEvent = function (event) {
        event = event || window.event // кросс-браузерно
        if (event.stopPropagation) {
            event.stopPropagation()
        } else {
            event.cancelBubble = true
        }
        if (event.preventDefault) {
            event.preventDefault()
        } else {
            event.returnValue = false
        }
    };

    window.addGroup = function (td, e, egv_id) {
        window.restart();
        grading._stopEvent(e);
        td_active = td;
        params.id = null;
        grading.tdAttrToParams(td.data());
        if (egv_id === 12) {
            grading.showMarkAddInputDialog(td, td[0].parentNode.rowIndex, grading.onValidateSor, egv_id);
        } else{
            grading.showMarkAddInputDialog(td, td[0].parentNode.rowIndex, grading.onValidate);
        }
    };

    window.acceptRecMark = function (elem) {

        var td = elem.parents("td");
        params = {
            'group_id': definedParams.g_id,
            'year': definedParams.year,
            's_id': definedParams.s_id,
            'training_type': definedParams.training_type
        };

        params.p_id = parseInt(td.parents('tr').find('td.pupil_name a').attr('id'));
        // рекомендуемая оценка
        params.rec_mark = elem.data('rec_mark');
        params.model = elem.data('model');
        params.egv_id = elem.data('egv_id');
        params.q_num = elem.closest('td').next('td').data('q_num');

        grading.saveMark(params, function (data) {
            // window.location.reload(true);
            elem.hide();
            elem.closest('td').next('td').html('<a class="mark_symbol" data-id="'+data.id+'" data-egv_id="'+params.egv_id+'">'+params.rec_mark+'</a>');
        });
    };

    // нажатие на Escape чтобы выйти из режима группового выставления оценок (13 - enter)
    $(document).keyup(function(e) {
        if (e.which === 27) {
            //при нажатии Esc - отменять групповое сохранение оценок
            window.restart();
            selth = false;

            group_push = false;
        }

        if (e.which === 13) {
            group_push = false;
            //групповое сохранение оценок при нажатии на enter
            for (let i = 0; i < group_marks.length; i++) {
                grading.saveMark(group_marks[i], null, null, null);
                window.restart();
            }
        }
    });

})();

$(function() {

    // Нажатие на плюсик или на оценку
    // $('td.is-add,td.is-update').on('click', 'a.mark_symbol.is-update,div.mark-plus', function() {
    $(document).on('click', 'a.mark_symbol,div.mark-plus', function() {
        openModal($(this).parents("td"), $(this));
    });

    // Нажатие на "Сохранить" в модалке
    $('button#modal_ok_button').on('click', function() {
        let egv_id = $('#modalMarksAddUpdate .egv-inp.active').attr('id'),
            mark_text = $('#modalMarksAddUpdate .egv-inp.active').html(),
            inputs  = $( '#modalMarksAddUpdate' ).serializeArray();

        window.saveMark(egv_id, mark_text, inputs);
        return false;
    });

    // Нажатие на "Удалить оценку" в модалке
    $('button#modal_delete_button').on('click', function() {
        window.deleteMark();
        return false;
    });

    // выделяем для определения egv_id
    $('#modalMarksAddUpdate .egv-inp').on('click', function() {
        if ($(this).attr('id') != 11) {
            $('div#modal_comment').show();
        } else {
            $('div#modal_comment').hide();
        }
        $('#modalMarksAddUpdate .egv-inp.active').removeClass('active');
        $(this).addClass('active');
        // очистка инпута если выбрана "Н"
        $('#modalMarksAddUpdate .egv-inp:not(.active)').val(null);
    });

    $('#modalMarksAddUpdate .egv-inp').on('blur', function(eventData) {
        var isActive = $(eventData.currentTarget).hasClass('active');
        var isEmpty = $(eventData.currentTarget).val() === '';

        // элемент с классом "active" не должен быть пустым
        if(isActive && isEmpty) {
            $(this).removeClass('active');
        }
    });

    function removeContainer() {
        $('div#GradebookMarkList table tbody tr div.markControls').remove();
        $('div.add').removeClass('active');
        $('div.editable-container').remove();
    }

    let sx, selth = false;
    // Нажатие на заголовок урока (поле с датой урока)
    // появятся кнопки с оценками (th.lplan)
    $('#GradebookMarkList thead th').on('click', 'a', function() {
        removeContainer();
        group_push = true; //указать что групповые оценки открыты
        group_marks = []; //очистить список групповых оценок

        //блокировка повторного нажатия
        /*if (sx === $(this).parents('th').index() && selth) {
            return;
        }*/
        sx = $(this).parents('th').index();
        selth = true;
        removeContainer();
        let egv, egv_array, limit, marks_count;
        $('input[name="inputMark"]').detach();

        $('div#modalmark div#modal_marks a').removeClass('active');
        $('div#modalmark div#modal_marks a').hide();
        $('div#GradebookMarkList table tbody tr').find('td:nth-child(' + ($(this).parents('th').index()+1) + ')').children('div.add').addClass('active');
        $('td.current div.add.active').each(function(i,elem) {
            // проверка на кол-во выставляемых оценок
            limit = $(elem).parent().data('limit');
            marks_count = $(elem).parent().find('a.mark_symbol').length;
            if (limit <= marks_count) {
                return;
            }

            //контейнер для оценок
            $(this).html('<div style="display: block; position: relative;"  class="popover fade in editable-container right"><nobr>'
                + $('div#modalmark div#modal_marks').html()  + '</nobr></div>');

            // загрузка кнопок или инпутов для выставления оценок
            egv = $(elem).parent().data('egv');
            if (egv !== undefined) {
                if (egv.indexOf(',') !== -1) {
                    egv_array = egv.split(',');
                    egv_array.forEach(function (id) {
                        // костыль оценки Слов исключаем
                        if (['11'].indexOf(id)!==-1) {
                            return;
                        }
                        $(elem).find('a#' + id).show();
                    });
                } else {
                    $(elem).find('a#' + egv).show();
                }
            }
        });

        //для итоговых четвертных (зачёт\не зачёт)
        $('td.quarter div.add.active').each(function(i,elem) {
            // проверка на кол-во выставляемых оценок
            limit = $(elem).parent().data('limit');
            marks_count = $(elem).parent().find('a.mark_symbol').length;
            if (limit <= marks_count) {
                return;
            }

            //контейнер для оценок
            $(this).html('<div style="display: block; position: relative;"  class="popover fade in editable-container right"><nobr>'
                + $('div#modalmark div#modal_marks').html()  + '</nobr></div>');

            // загрузка кнопок или инпутов для выставления оценок
            egv = $(elem).parent().data('egv');
            if (egv !== undefined) {
                if (egv !== 38 && egv.indexOf(',') !== -1) {
                    egv_array = egv.split(',');
                    egv_array.forEach(function (id) {
                        // костыль оценки Слов исключаем
                        if (['11'].indexOf(id)!==-1) {
                            return;
                        }
                        $(elem).find('a#' + id).show();
                    });
                } else {
                    $(elem).find('a#' + egv).show();
                }
            }
        });
    });


    $(document).on('click', 'td.current div.add div.editable-container a', function() {
        saveMarkGroup($(this));
    });

    $(document).on('click', 'td.quarter div.add div.editable-container a', function() {
        saveMarkGroup($(this));
    });


    // нажатие на Escape чтобы выйти из режима группового выставления оценок (13 - enter)
    /*$(document).keyup(function(e) {
        if (e.which === 27) {
            window.restart();
            selth = false;
        }
    });*/

    //Добавление балла за СОР и СОЧ
    $('#GradebookMarkList').on('click','td.sor.is-add',function(e) {
        // console.log('test');
        let target = e.target;
        if ( !(target === this) ) return;
        window.addGroup($(this), e, 12);
    });

    $('#GradebookMarkList').on('click','td.standard.is-add',function(e) {
        let target = e.target;
        if ( !(target === this) ) return;
        window.addGroup($(this), e);
    });

    //сохранение максимального балла для отдельной ячейки в таблице
    $('input[name="editable_TES_maximum_ball"], ' +
        'input[name="editable_amount_TES_pupil_ball"], input[name="editable_amount_TES_maximum_ball"], ' +
        'input[name="editable_amount_TEQ_pupil_ball"], input[name="editable_amount_TEQ_maximum_ball"]').change(function() {

        var ball = $( this ).val();
        var original_ball = $( this ).attr('orig_ball');
        var pupil_id = $( this ).attr('pupil_id');
        var lesson_plan_id = $( this ).attr('lesson_plan_id');
        var training_type = $( this ).attr('training_type');
        var input_name = $( this ).attr('name');
        var ajax_url = '/ajax/maximumBallSave';
        if (input_name == 'editable_amount_TES_pupil_ball') {
            ajax_url = '/ajax/amountTESPupilBallSave';
        } else if (input_name == 'editable_amount_TES_maximum_ball') {
            ajax_url = '/ajax/amountTESMaximumBallSave';
        } else if (input_name == 'editable_amount_TEQ_pupil_ball') {
            ajax_url = '/ajax/amountTEQPupilBallSave';
        } else if (input_name == 'editable_amount_TEQ_maximum_ball') {
            ajax_url = '/ajax/amountTEQMaximumBallSave';
        }
        $( this ).removeClass('error');
        if (ball !== "" && ball.length !== ""){
            if (!$.isNumeric(ball)){
                $( this ).addClass('error');
                Notify.showMsg({status:'err', text:'Значение должно быть числом'});
                $( this ).val(original_ball)
                return;
            }
            ball = new Number(ball);
            if ( !((ball > 0) && (ball <= 100)) ){
                $( this ).addClass('error');
                Notify.showMsg({status:'err', text:'Значение должно быть между 1 и 100'});
                $( this ).val(original_ball)
                return;
            }
        }
        $.post(ajax_url,
            {
                ball : ball,
                lesson_plan_id : lesson_plan_id,
                pupil_id: pupil_id,
                training_type : training_type
            },
            function (data) {
                if (data.status == 'ok') {
                    Notify.showMsg(data);
                    window.location.reload(true);
                }
                if (data.status == 'err') {
                    Notify.showMsg(data);
                }
            },
            'json'
        );
    });

    $(document).on('click', 'a.sdot-record', function() {
        var type = $(this).data('type');
        $('#'+type+'Modal').modal('show');
        if (type == 'tasks') {
            window.showTask($(this).data('record_id'), $(this).data('link_id'), $(this).data('pupil_id'));
        } else if (type == 'tests') {
            window.showTest($(this).data('record_id'), $(this).data('link_id'), $(this).data('pupil_id'));
        }
    });

    $(document).on('click', '#tasksModal .btn-accept-task', function() {
        window.saveTaskResult(2);
    });

    $(document).on('click', '#tasksModal .btn-return-task', function() {
        window.saveTaskResult(3);
    });

    $(document).on('click', '#testsModal .btn-accept-test', function() {
        window.saveTestResult(2);
    });

    $(document).on('click', '#testsModal .btn-return-test', function () {
        window.saveTestResult(3);
    });

    $(document).on('click', '#showTaskContainer', function () {
        $('.task-container').toggle();
        $(this).find('span').toggle();

        if (window.MathJax) {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
        }
        // $(this).remove();
    });

    $(document).on('click', '#showTestContainer', function () {
        window.showTestQuestion($(this).data('record_id'), $(this).data('pupil_id'));
        $('.test-container').toggle();
        $(this).find('span').toggle();

        if (window.MathJax) {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
        }
    });

    $(document).on('click', '#previewModalCloseBtn', function () {
        // $('#previewModal').hide();
        $('.preview-document-image').hide();
        $('.preview-document-iframe').hide();
        $('.preview-document-others').hide();
        $('.preview-document-audio').hide();
        $('.preview-document-video').hide();
        //зачистить от предыдущих данных:
        $('.preview-document-image').find('img').attr('src', '');
        $('.preview-document-iframe').attr('src','');
        $('.preview-document-audio audio').attr('src', '');
        $('.preview-document-video video').attr('src', '');

        if ($('audio')){
            $('.preview-document-audio audio').trigger("pause");
        }
        if ($('video')){
            $('.preview-document-video video').trigger("pause");
        }
    });

    $(document).on('click', '.rotate-image', function () {
        var step = 90;
        var el = $(this).parent().find('img.rotatable');
        var d = el.data('angle') + step;
        el.css("transform","rotate("+d+"deg)");
        if (d >= 360) d = 0;
        el.data('angle', d);
    });

    $(document).on('click', '.preview_file_btn', function () {
        let preview_url = $(this).attr('preview_url');
        let preview_ext = preview_url.split('.').pop().toLowerCase();
        let isPreviewModalShow = true;
        let ext_types = {
            "img": ["jpeg", "jpg", "png", "bmp", "gif"],
            "zip": ["zip", "rar", "7z", "jar", "tar"],
            "doc": ["docx", "doc"],
            "flp": ["flp", "flpx"],
            "html": ["html", "htm", "mhtml"],
            "xls": ["xls", "xlsx", "csv"],
            "pdf": ["pdf"],
            "ppt": ["ppt", "pptx"],
            "video": ["mpeg", "mpg", "mp4", "avi", "mkv", "flv", "mov"],
            "txt": ["txt", "rtf"],
            "audio": ["mp3"]
        };
        for (let k in ext_types) {
            for (let p of ext_types[k]) {
                if (preview_ext === p) {
                    switch (k) {
                        case 'doc':
                        case 'xls':
                        case 'pdf':
                        case 'ppt':
                            $('.preview-document-iframe').show();
                            $('.preview-document-iframe').attr('src','https://docs.google.com/viewerng/viewer?url='+preview_url+'&embedded=true');
                            break;
                        case 'img':
                            $('.preview-document-image').show();
                            $('.preview-document-image').find('a img').attr('src', preview_url);
                            $('.preview-document-image').find('a').attr('href', preview_url);

                            $('#lightgallery').lightGallery({
                                thumbnail:true,
                            });

                            $('.open_lightgallery_btn').on('click',function () {
                                $('#lightgallery a').click();
                            });
                            break;
                        case 'audio':
                            $('.preview-document-audio').show();
                            $('.preview-document-audio audio').attr('src', preview_url);
                            break;
                        case 'video':
                            $('.preview-document-video').show();
                            $('.preview-document-video video').attr('src', preview_url);
                            break;
                        case 'zip':
                        // case 'img':
                        //     isPreviewModalShow = false;
                        //     window.open(preview_url);
                        //     break;
                        default:
                            $('.preview-document-others').show();
                            $('.preview-document-others').attr('href', preview_url);
                            $('.preview-document-others').text(preview_url);
                    }
                }
            }
        }
        if(isPreviewModalShow){
            $('.preview-document-iframe').parent().css('max-height', '600px');
            $('#previewModal').modal('show');
        }
    });


    $(document).on('hidden.bs.modal', '#tasksModal', function () {
        window.revertStatusResults();
    })

    $('#modalmark').hide();
    $('#tasksModal').hide();
    $('#testsModal').hide();
    $('#previewModal').hide();



    $(document).on('onInit.fb', function (e, instance) {
        if ($('.fancybox-toolbar').find('#rotate_button').length === 0) {
            $('.fancybox-toolbar').prepend('<button id="rotate_button" class="fancybox-button fa fa-rotate-right" title="Повернуть"></button>');
        }
        var click = 1;
        $('.fancybox-toolbar').on('click', '#rotate_button', function () {
            var n = 90 * ++click;
            $('.fancybox-slide--current img').css('webkitTransform', 'rotate(-' + n + 'deg)');
            $('.fancybox-slide--current img').css('mozTransform', 'rotate(-' + n + 'deg)');
            $('.fancybox-slide--current img').css('transform', 'rotate(-' + n + 'deg)');
        });
    });


    // перенос Рекомендуемой оценки в четвертную
    $('button.btn-accept-recommended').on('click', function() {
        window.acceptRecMark($(this));
        return false;
    });

});
