// definitions
var setup = {};
var chart = null; // chart instance
var just_stored_hash = ""; // determine if hash change is in progress
let url = 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv';
let ready_to_refresh = false;


$(function () {
    // DOM configuration
    $("#outbreak-threshold").ionRangeSlider({
        skin: "big",
        //type: "double",
        grid: true,
        min: 0,
        max: 50
                //from: setup["outbreak-threshold"]
    });


    $("#day-range").ionRangeSlider({
        skin: "big",
        type: "double",
        grid: true,
        min: 0,
        max: 50, //XX setup["day-range"][1],
        to: 50, //XXsetup["day-range"][1],
        from: 0
    });

    // refresh on input change
    $("#setup input:not(.irs-hidden-input)").change(refresh); // every normal input change
    $("#setup input.irs-hidden-input").each(function () { // sliders
        let opt = $(this).data("ionRangeSlider").options;
        opt.onFinish = refresh;
        // do not change window hash when moving input slider
        opt.onChange = () => {
            refresh(false);
        };
    });




// runtime

    $.get(url, (data) => {
        // we need to build Territory objects from CSV first
        Territory.build(data);

        // draw territories
        let $territories = $("#territories");
        let td = (col_id, storage) => {
            let text = [];
            for (let o of Object.values(storage)) {
                text.push(o.get_html());
            }
            $("> div:eq(" + col_id + ")", $territories).append(text.join(""));
        };
        td(0, Territory.states);
        td(1, Territory.countries);
        td(2, Territory.continents);
        $("> div", $territories).on("click", "> div", function (event) {
            let t = Territory.get_id($(this).attr("id"));
            if (event.target === $("span:eq(1)", $(this))[0]) { // un/star all
                if (t.set_star(null) && !t.is_active) {
                    t.set_active();
                }
            } else if (event.target === $("span:eq(2)", $(this))[0]) { // hide/show all
                t.toggle_children_visibility();
            } else if (event.target === $("span:eq(3)", $(this))[0]) { // un/check all
                t.toggle_children_checked();
            } else if (event.target.type !== "checkbox") { // toggle clicked territory
                $("input:checkbox", $(this)).click();
            } else {
                t.set_active($(event.target).prop("checked"));
            }
            refresh();
        });
        $("#uncheck-all").click(Territory.uncheck_all);

        // document events
        window.addEventListener('hashchange', () => {
            console.log("HASH change event");
            load_hash();
        }, false);
        refresh_setup(true, false);

        // start plotting
        if (!Plot.plots.length) {
            console.log("CREATING NEW");
            (new Plot()).focus(); // current plot
            for (let country of european_countries) { // X ["Czechia", "United Kingdom"]
                Territory.get(country, Territory.COUNTRY).set_active();
            }
        } else {
            console.log("USING OLD");
            Plot.plots[0].focus();
        }
        refresh(set_ready = true);
    });
});

/**
 * @param {type} csv Raw data from github
 * @returns {Array} Sorted by chosen countries.
 */
function prepare_plot_data() {
    let result = [];   // countries with outbreak
    for (let t of Plot.current_plot.checked) {
        let line = t.data["confirmed"];
        let outbreak_data = [];
        let ignore = true;
        for (let j = 0; j < line.length; j++) {
            if (line[j] >= setup["outbreak-threshold"]) { // append the data starting with threshold
                ignore = false;
            }
            if (!ignore) {
                outbreak_data.push(line[j]);
            }
        }
        result.push([t, outbreak_data]);
    }
    //console.log("Plot data", result);
    return result;
}


function load_hash() {
    console.log("Load hash trying");
    try {
        let hash = "{" + decodeURI(window.location.hash.substr(1)) + "}";
        //console.log("Hash", hash, just_stored_hash);
        if (hash === just_stored_hash) {
            return;
        }
        setup = JSON.parse(hash);
    } catch (e) {
        return;
    }
    console.log("LOAD HASH NOW *******");
    for (let key in setup) {
        let val = setup[key];
        if (key === "plots") {
            Plot.deserialize(val);
            //plot = Plot.current_plot;
            console.log("NOVY PLOT", Plot.current_plot);
            continue;
        }
        let $el = $("#" + key);
        if (!key in setup) {
            continue;
        }
        if ((r = $el.data("ionRangeSlider"))) {
            if (r.options.type === "double") {
                r.update({from: val[0], to: val[1]});
            } else {
                r.update({from: val});
            }
        } else if ($el.attr("type") === "checkbox") {
            $el.prop("checked", val);
        } else {
            $el.val(val);
        }
    }
    refresh();
}


function refresh_setup(load_from_hash = false, allow_window_hash_change = true) {
    $("#setup input").each(function () {
        // Load value from the $el to setup.
        $el = $(this);
        let key = $el.attr("id");
        let val;
        if ((r = $el.data("ionRangeSlider"))) {
            if (r.options.type === "double") {
                val = [r.result.from, r.result.to];
            } else {
                val = r.result.from;
            }
        } else if ($el.attr("type") === "checkbox") {
            val = $el.prop("checked") ? 1 : 0;
        } else {
            val = $el.val();
        }
        setup[key] = val;
    });

    if (load_from_hash) {
        console.log("HASH load");
        load_hash();
    } else if (allow_window_hash_change) {
        // save to hash
        setup["plots"] = Plot.serialize();
        let s = just_stored_hash = JSON.stringify(setup);
        //console.log("JSUT stored", just_stored_hash);
        window.location.hash = s.substring(1, s.length - 1);
}
}

function init_chart() {
    let ctx = $("#chart");
    chart = new Chart(ctx, {
        type: 'line',
        data: {},
        options: {
            tooltips: {
                mode: 'index',
                intersect: false
            },
            scales: {
                xAxes: [{
                        display: true,
                        scaleLabel: {
                            display: true
                        }
                    }],
                yAxes: [{
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: 'Total confirmed cases'
                        },
                        ticks: {
                            callback: function (value, index, values) {
                                return Number(value.toString());
                            }
                        }
                    }]
            }
        }
    });
}


/**
 *
 * @param {bool|Event} event True -> make refresh possible further on. False -> refresh but do not change window hash (would stop slider movement). Event -> callback from an input change, no special action.
 * @returns {Boolean}
 */
function refresh(event = null) {
    // pass only when ready
    if (event === true) {
        ready_to_refresh = true;
    } else if (!ready_to_refresh) {
        return false;
    }
    // assure `setup` is ready
    refresh_setup(false, event !== false);


    // build chart data
    // process each country
    let longest_data = 0;
    let datasets = {};
    for (let [territory, data] of prepare_plot_data()) {
        // choose only some days in range
        if (!data.length) {
            continue;
        }
        let chosen_data = [];
        for (let i = setup["day-range"][0]; i < data.length && i < setup["day-range"][1]; i++) {
            chosen_data.push(data[i]);
        }

        longest_data = Math.max(longest_data, chosen_data.length);
        //console.log("Territory", territory.name, territory.is_starred);
        // push new dataset
        let dataset = {
            type: 'line',
            borderColor: "#" + intToRGB(hashCode(territory.get_name())), //"#5793DB",
            label: territory.get_name(true),
            data: chosen_data,
            borderWidth: territory.is_starred ? 6 : 3,
            fill: false,
            backgroundColor: "#" + intToRGB(hashCode(territory.get_name())), //"#5793DB",
            id: territory.id
        };
        datasets[territory.id] = dataset;
    }
    let labels = range(setup["day-range"][0], Math.min(longest_data, setup["day-range"][1])).map(String);

    // update chart data
    if (!chart) {
        init_chart();
        chart.data = {datasets: Object.values(datasets), labels: labels};
    } else {
        // update just some datasets, do not replace them entirely (smooth movement)
        chart.data.labels = labels;
        let removable = [];
        // update changed
        for (let o of chart.data.datasets) {
            if (o.id in datasets) { // update changes
                let d = datasets[o.id];
                o.data = d.data;
                o.borderWidth = d.borderWidth;
                o.label = d.label;
                delete datasets[o.id];
            } else {
                removable.push(o);
            }
        }
        // remove unused
        chart.data.datasets = chart.data.datasets.filter((el) => !removable.includes(el));
        // insert new
        Object.values(datasets).forEach(el => chart.data.datasets.push(el));
    }
    chart.options.scales.xAxes[0].scaleLabel.labelString = `Days count since >= ${setup["outbreak-threshold"]} confirmed cases`;
    chart.options.scales.yAxes[0].type = setup["log-switch"] ? "logarithmic" : "linear";
    chart.update();
}

